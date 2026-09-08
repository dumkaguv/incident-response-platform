import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '@/app/app.module'

type Server = Parameters<typeof request>[0]

async function createApp(): Promise<INestApplication> {
  const fixture = await Test.createTestingModule({
    imports: [AppModule]
  }).compile()
  const app = fixture.createNestApplication()

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.init()

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
    const single = await gql('{ a: incidents(first: 1) { totalCount } }')
    const triple = await gql(`{
      a: incidents(first: 1) { totalCount }
      b: incidents(first: 1) { totalCount }
      c: incidents(first: 1) { totalCount }
    }`)

    const before = Number(single.headers['x-ratelimit-remaining-burst'])
    const after = Number(triple.headers['x-ratelimit-remaining-burst'])

    expect(before - after).toBe(1)
  })

  it('answers TOO_MANY_REQUESTS with Retry-After once the burst tier is spent', async () => {
    let blocked: Awaited<ReturnType<typeof gql>> | undefined

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await gql('{ incidents(first: 1) { totalCount } }')

      if (response.body.errors) {
        blocked = response
        break
      }
    }

    expect(blocked).toBeDefined()
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
