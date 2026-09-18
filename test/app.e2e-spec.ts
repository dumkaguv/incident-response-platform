import { INestApplication } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { AppModule } from '@/app/app.module'

type Server = Parameters<typeof request>[0]

const MISSING_ID = '00000000-0000-0000-0000-000000000000'

describe('the application surface', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.THROTTLE_WRITE_BURST_LIMIT = '10000'

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
  })

  function gql(query: string) {
    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({ query })
  }

  it('answers a health probe without touching the rate limiter', async () => {
    const response = await request(app.getHttpServer() as Server).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-ratelimit-limit-burst']).toBeUndefined()
  })

  it('reports readiness only after the database answered', async () => {
    const response = await request(app.getHttpServer() as Server).get(
      '/health/ready'
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', database: 'ok' })
  })

  it('accepts an empty patch and leaves the monitor as it was', async () => {
    const created = await gql(`mutation {
      createMonitor(input: { name: "Untouched", url: "https://example.com" }) { id name }
    }`)
    const id = created.body.data.createMonitor.id as string

    try {
      const patched = await gql(`mutation {
        updateMonitor(id: "${id}", input: {}) { id name }
      }`)

      expect(patched.body.errors).toBeUndefined()
      expect(patched.body.data.updateMonitor).toEqual({ id, name: 'Untouched' })
    } finally {
      await gql(`mutation { deleteMonitor(id: "${id}") { id } }`)
    }
  })

  it('rejects a page size outside the allowed range as user input', async () => {
    const response = await gql('{ monitors(first: 0) { totalCount } }')

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toMatch(/^Page size must be/)
  })

  it('refuses null for a required monitor field on update', async () => {
    const response = await gql(`mutation {
      updateMonitor(id: "${MISSING_ID}", input: { name: null }) { id }
    }`)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toBe('Validation failed')
  })

  it('lets GraphQL itself refuse null for a defaulted create field', async () => {
    const response = await gql(`mutation {
      createMonitor(input: { name: "Probe", url: "https://example.com", method: null }) { id }
    }`)

    expect(response.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED'
    )
  })

  it('stops a document with more tokens than the parser allows', async () => {
    const aliases = Array.from(
      { length: 3000 },
      (_, index) => `a${String(index)}: id`
    ).join(' ')
    const response = await gql(`{ monitors { nodes { ${aliases} } } }`)

    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body.errors)).toMatch(/tokens/)
  })

  it('refuses a document with more fields than the limit before validating it', async () => {
    const aliases = Array.from(
      { length: 1200 },
      (_, index) => `a${String(index)}: id`
    ).join(' ')
    const response = await gql(`{ monitors { nodes { ${aliases} } } }`)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toMatch(
      /^Query selects 1202 fields, which exceeds the limit of 1000$/
    )
  })

  it('refuses one response key repeated past the limit', async () => {
    const aliases = Array.from({ length: 30 }, () => 'a: id').join(' ')
    const response = await gql(`{ monitors { nodes { ${aliases} } } }`)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toMatch(/repeats the field "a"/)
  })

  it('answers a count-only page without asking for its rows', async () => {
    const response = await gql('{ monitors { totalCount } }')

    expect(response.body.errors).toBeUndefined()
    expect(typeof response.body.data.monitors.totalCount).toBe('number')
  })

  it('refuses a filter that spends more values than the budget', async () => {
    const values = Array.from(
      { length: 3 },
      () =>
        `{ name: { in: [${Array.from({ length: 1000 }, (_, index) => `"n${String(index)}"`).join(', ')}] } }`
    ).join(', ')
    const response = await gql(
      `{ monitors(filter: { and: [${values}] }) { totalCount } }`
    )

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toMatch(/at most 2000 values/)
  })

  it('refuses a date-time whose offset no database could store', async () => {
    const response = await gql(
      '{ monitors(filter: { createdAt: { gt: "2026-09-18T12:30:00+99:99" } }) { totalCount } }'
    )

    expect(JSON.stringify(response.body.errors)).toMatch(/RFC 3339/)
  })

  it('still reports a missing monitor when the patch is valid', async () => {
    const response = await gql(`mutation {
      updateMonitor(id: "${MISSING_ID}", input: { name: "Renamed" }) { id }
    }`)

    expect(response.body.errors[0].extensions.code).toBe('NOT_FOUND')
  })
})
