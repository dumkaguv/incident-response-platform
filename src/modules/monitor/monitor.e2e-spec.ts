import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { INestApplication } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { AppModule } from '@/app/app.module'

type HttpServer = Parameters<typeof request>[0]

describe('monitor module (e2e)', () => {
  let app: INestApplication
  let target: Server
  let origin: string
  let monitorId: string

  beforeAll(async () => {
    process.env.THROTTLE_WRITE_BURST_LIMIT = '10000'
    target = createServer((incoming, response) => {
      response.statusCode = incoming.url === '/bad' ? 503 : 200
      response.end('probe body')
    })
    await new Promise<void>((resolve) => {
      target.listen(0, '127.0.0.1', resolve)
    })

    const { port } = target.address() as AddressInfo

    origin = `http://127.0.0.1:${String(port)}`

    const fixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = fixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    delete process.env.THROTTLE_WRITE_BURST_LIMIT
    await app.close()
    await new Promise<void>((resolve) => {
      target.close(() => {
        resolve()
      })
    })
  })

  function gql(query: string, variables?: Record<string, unknown>) {
    return request(app.getHttpServer() as HttpServer)
      .post('/graphql')
      .send({ query, variables })
  }

  async function data(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const response = await gql(query, variables).expect(200)

    expect(response.body.errors).toBeUndefined()

    return response.body.data
  }

  async function failure(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<string> {
    const response = await gql(query, variables)

    return response.body.errors[0].extensions.code
  }

  it('creates a monitor and fills the defaults the schema promises', async () => {
    const created = await data(
      `mutation ($input: CreateMonitorInput!) {
        createMonitor(input: $input) {
          id name url method intervalSeconds timeoutMs
          expectedStatusMin expectedStatusMax isActive nextCheckAt
          lastStatus lastCheckedAt lastStatusCode lastResponseTimeMs
          consecutiveFailures createdAt
        }
      }`,
      { input: { name: 'Probe target', url: `${origin}/ok` } }
    )
    const monitor = created.createMonitor as Record<string, unknown>

    monitorId = monitor.id as string

    expect(monitor).toMatchObject({
      name: 'Probe target',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
      isActive: true,
      lastStatus: null,
      lastCheckedAt: null,
      lastStatusCode: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0
    })
    expect(monitor.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(monitor.nextCheckAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('refuses a url that is not http', async () => {
    const code = await failure(
      `mutation ($input: CreateMonitorInput!) {
        createMonitor(input: $input) { id }
      }`,
      { input: { name: 'Bad scheme', url: 'ftp://example.test/file' } }
    )

    expect(code).toBe('BAD_USER_INPUT')
  })

  it('refuses an interval below the floor', async () => {
    const code = await failure(
      `mutation ($input: CreateMonitorInput!) {
        createMonitor(input: $input) { id }
      }`,
      {
        input: { name: 'Too eager', url: `${origin}/ok`, intervalSeconds: 1 }
      }
    )

    expect(code).toBe('BAD_USER_INPUT')
  })

  it('refuses a status range whose floor exceeds its ceiling', async () => {
    const created = await failure(
      `mutation ($input: CreateMonitorInput!) {
        createMonitor(input: $input) { id }
      }`,
      {
        input: {
          name: 'Backwards',
          url: `${origin}/ok`,
          expectedStatusMin: 500,
          expectedStatusMax: 200
        }
      }
    )
    const updated = await failure(
      `mutation ($id: ID!) {
        updateMonitor(id: $id, input: { expectedStatusMin: 400 }) { id }
      }`,
      { id: monitorId }
    )

    expect(created).toBe('BAD_USER_INPUT')
    expect(updated).toBe('BAD_USER_INPUT')
  })

  it('reads one monitor back and reports a missing one as NOT_FOUND', async () => {
    const one = await data(
      `query ($id: ID!) { monitor(id: $id) { id name } }`,
      {
        id: monitorId
      }
    )

    expect(one.monitor).toMatchObject({ id: monitorId, name: 'Probe target' })

    const code = await failure(
      `query { monitor(id: "00000000-0000-0000-0000-000000000000") { id } }`
    )

    expect(code).toBe('NOT_FOUND')
  })

  it('filters and searches the list', async () => {
    const filtered = await data(
      `query ($id: ID!) {
        monitors(filter: { id: { eq: $id } }, orderBy: [{ name: ASC }]) {
          totalCount
          nodes { id name }
        }
      }`,
      { id: monitorId }
    )

    expect(filtered.monitors).toMatchObject({ totalCount: 1 })

    const searched = await data(
      `query { monitors(search: "Probe target") { nodes { name } } }`
    )
    const names = (
      searched.monitors as { nodes: { name: string }[] }
    ).nodes.map((row) => row.name)

    expect(names).toContain('Probe target')
  })

  it('updates a monitor and leaves the untouched fields alone', async () => {
    const updated = await data(
      `mutation ($id: ID!, $input: UpdateMonitorInput!) {
        updateMonitor(id: $id, input: $input) {
          id name intervalSeconds timeoutMs isActive
        }
      }`,
      { id: monitorId, input: { name: 'Renamed target', isActive: false } }
    )

    expect(updated.updateMonitor).toMatchObject({
      name: 'Renamed target',
      isActive: false,
      intervalSeconds: 60,
      timeoutMs: 5000
    })
  })

  it('refuses to probe a paused monitor', async () => {
    const code = await failure(
      `mutation ($id: ID!) { checkMonitor(id: $id) { id } }`,
      { id: monitorId }
    )

    expect(code).toBe('CONFLICT')

    await data(
      `mutation ($id: ID!) {
        updateMonitor(id: $id, input: { isActive: true }) { isActive }
      }`,
      { id: monitorId }
    )
  })

  it('probes the target and records an UP check', async () => {
    const run = await data(
      `mutation ($id: ID!) {
        checkMonitor(id: $id) {
          id monitorId status statusCode responseTimeMs errorType
          errorMessage checkedAt
        }
      }`,
      { id: monitorId }
    )
    const check = run.checkMonitor as Record<string, unknown>

    expect(check).toMatchObject({
      monitorId,
      status: 'UP',
      statusCode: 200,
      errorType: null
    })
    expect(check.responseTimeMs).toBeTypeOf('number')
  })

  it('records a mismatched code as DOWN with INVALID_STATUS_CODE', async () => {
    const created = await data(
      `mutation ($input: CreateMonitorInput!) {
        createMonitor(input: $input) { id }
      }`,
      { input: { name: 'Failing target', url: `${origin}/bad` } }
    )
    const failing = (created.createMonitor as { id: string }).id
    const run = await data(
      `mutation ($id: ID!) {
        checkMonitor(id: $id) { status statusCode errorType errorMessage }
      }`,
      { id: failing }
    )

    expect(run.checkMonitor).toMatchObject({
      status: 'DOWN',
      statusCode: 503,
      errorType: 'INVALID_STATUS_CODE'
    })
  })

  it('finds a check again by the exact checkedAt it returned', async () => {
    const shown = await data(
      `query ($id: ID!) {
        monitorChecks(filter: { monitorId: { eq: $id } }, first: 1) {
          nodes { id checkedAt }
        }
      }`,
      { id: monitorId }
    )
    const [check] = (
      shown.monitorChecks as { nodes: { id: string; checkedAt: string }[] }
    ).nodes
    const matched = await data(
      `query ($id: ID!, $checkedAt: DateTime!) {
        monitorChecks(filter: { id: { eq: $id }, checkedAt: { eq: $checkedAt } }) {
          totalCount
        }
      }`,
      { id: check.id, checkedAt: check.checkedAt }
    )

    expect(check.checkedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/
    )
    expect(matched.monitorChecks).toMatchObject({ totalCount: 1 })
  })

  it('carries the probe outcome onto the monitor itself', async () => {
    const after = await data(
      `query ($id: ID!) {
        monitor(id: $id) {
          lastStatus lastStatusCode lastResponseTimeMs lastCheckedAt
          consecutiveFailures nextCheckAt
        }
      }`,
      { id: monitorId }
    )
    const monitor = after.monitor as Record<string, unknown>

    expect(monitor).toMatchObject({
      lastStatus: 'UP',
      lastStatusCode: 200,
      consecutiveFailures: 0
    })
    expect(monitor.lastResponseTimeMs).toBeTypeOf('number')
    expect(Date.parse(monitor.nextCheckAt as string)).toBeGreaterThan(
      Date.parse(monitor.lastCheckedAt as string)
    )
  })

  it('serves the history as a root connection filtered by monitor', async () => {
    const history = await data(
      `query ($id: ID!) {
        monitorChecks(filter: { monitorId: { eq: $id } }, first: 5) {
          totalCount
          nodes { status checkedAt monitor { id name } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { id: monitorId }
    )

    expect(history.monitorChecks).toMatchObject({
      totalCount: 1,
      nodes: [{ monitor: { id: monitorId, name: 'Renamed target' } }]
    })
  })

  it('pages the nested connection per monitor', async () => {
    const nested = await data(
      `query {
        monitors(first: 10) {
          nodes {
            id
            checks(first: 2) {
              totalCount
              nodes { status }
              pageInfo { hasNextPage }
            }
          }
        }
      }`
    )
    const rows = (
      nested.monitors as {
        nodes: {
          id: string
          checks: { totalCount: number; nodes: unknown[] }
        }[]
      }
    ).nodes
    const mine = rows.find((row) => row.id === monitorId)

    expect(mine?.checks.totalCount).toBe(1)
    for (const row of rows) {
      expect(row.checks.nodes.length).toBeLessThanOrEqual(2)
    }
  })

  it('offers no filter or search on the nested connection', async () => {
    const code = await failure(
      `query {
        monitors(first: 1) { nodes { checks(first: 1, search: "x") { totalCount } } }
      }`
    )

    expect(code).toBe('GRAPHQL_VALIDATION_FAILED')
  })

  it('deletes the monitor and takes its history with it', async () => {
    await data(`mutation ($id: ID!) { deleteMonitor(id: $id) { id } }`, {
      id: monitorId
    })

    const code = await failure(`query ($id: ID!) { monitor(id: $id) { id } }`, {
      id: monitorId
    })

    expect(code).toBe('NOT_FOUND')

    const orphans = await data(
      `query ($id: ID!) {
        monitorChecks(filter: { monitorId: { eq: $id } }) { totalCount }
      }`,
      { id: monitorId }
    )

    expect(orphans.monitorChecks).toMatchObject({ totalCount: 0 })
  })
})
