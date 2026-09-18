import { INestApplication } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { AppModule } from '@/app/app.module'
import { WRITE_TIERS } from '@/core/throttler'

type Server = Parameters<typeof request>[0]

async function createApp(): Promise<INestApplication> {
  const fixture = await Test.createTestingModule({
    imports: [AppModule]
  }).compile()
  const app = fixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter()
  )

  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  return app
}

describe('rate limiting: the GraphQL tier', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.THROTTLE_HTTP_LIMIT = '10000'
    process.env.THROTTLE_BURST_LIMIT = '8'
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.THROTTLE_BURST_LIMIT
    delete process.env.THROTTLE_HTTP_LIMIT
  })

  function gql(query: string) {
    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({ query })
  }

  it('counts one hit per request, not one per root field', async () => {
    const single = await gql('{ a: monitors(first: 1) { totalCount } }')
    const triple = await gql(`{
      a: monitors(first: 1) { totalCount }
      b: monitors(first: 1) { totalCount }
      c: monitors(first: 1) { totalCount }
    }`)

    const before = Number(single.headers['x-ratelimit-remaining-sustained'])
    const after = Number(triple.headers['x-ratelimit-remaining-sustained'])

    expect(before - after).toBe(1)
  })

  it('answers TOO_MANY_REQUESTS with Retry-After once the burst tier is spent', async () => {
    let blocked: Awaited<ReturnType<typeof gql>> | undefined

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await gql('{ monitors(first: 1) { totalCount } }')

      if (response.body.errors) {
        blocked = response
        break
      }
    }

    expect(blocked).toBeDefined()
    expect(blocked?.status).toBe(429)
    expect(blocked?.body.errors[0].extensions.code).toBe('TOO_MANY_REQUESTS')
    expect(blocked?.body.errors[0].message).toMatch(/retry in \d+ seconds/)
    expect(Number(blocked?.headers['retry-after'])).toBeGreaterThan(0)
  })
})

describe('rate limiting: the HTTP wall in front of the parser', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.THROTTLE_HTTP_LIMIT = '6'
    process.env.THROTTLE_BURST_LIMIT = '10000'
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.THROTTLE_BURST_LIMIT
    delete process.env.THROTTLE_HTTP_LIMIT
  })

  it('rejects with a real HTTP 429 before the query is parsed', async () => {
    let blocked: { status: number; body: unknown; retryAfter: string } | null =
      null

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer() as Server)
        .post('/graphql')
        .send({ query: 'this is not valid graphql at all' })

      if (response.status === 429) {
        blocked = {
          status: response.status,
          body: response.body,
          retryAfter: response.headers['retry-after']
        }
        break
      }
    }

    expect(blocked).not.toBe(null)
    expect(blocked?.status).toBe(429)
    expect(blocked?.body).toEqual({
      errors: [
        {
          message: expect.stringMatching(
            /^Too many requests, retry in \d+ seconds$/
          ),
          extensions: { code: 'TOO_MANY_REQUESTS' }
        }
      ]
    })
    expect(Number(blocked?.retryAfter)).toBeGreaterThan(0)
  })
})

describe('rate limiting: a mutation takes the write tier by itself', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.THROTTLE_HTTP_LIMIT = '10000'
    process.env.THROTTLE_BURST_LIMIT = '9999'
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.THROTTLE_BURST_LIMIT
    delete process.env.THROTTLE_HTTP_LIMIT
  })

  function gql(query: string) {
    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({ query })
  }

  it('bills a query against the read tier and a mutation against the write tier', async () => {
    const read = await gql('{ monitors(first: 1) { totalCount } }')
    const write = await gql(`mutation {
      deleteMonitor(id: "00000000-0000-0000-0000-000000000000") { id }
    }`)

    expect(Number(read.headers['x-ratelimit-limit-burst'])).toBe(9999)
    expect(Number(write.headers['x-ratelimit-limit-burst'])).toBe(
      WRITE_TIERS.burst.limit
    )
  })
})

describe('rate limiting: one budget per client across root fields', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.THROTTLE_HTTP_LIMIT = '10000'
    process.env.THROTTLE_BURST_LIMIT = '1'
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.THROTTLE_BURST_LIMIT
    delete process.env.THROTTLE_HTTP_LIMIT
  })

  function gql(query: string) {
    return request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({ query })
  }

  it('cannot be sidestepped by leading with a field nobody has asked for yet', async () => {
    const first = await gql('{ monitors(first: 1) { totalCount } }')
    const second = await gql(`{
      monitorChecks(first: 1) { totalCount }
      monitors(first: 1) { totalCount }
    }`)

    expect(first.body.errors).toBeUndefined()
    expect(second.status).toBe(429)
    expect(second.body.errors[0].extensions.code).toBe('TOO_MANY_REQUESTS')
    expect(second.body.data).toBeNull()
  })
})
