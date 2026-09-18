import { INestApplication, ValidationPipe } from '@nestjs/common'
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
    const fixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = fixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    app.useGlobalPipes(new ValidationPipe({ transform: true }))
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
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

  it('still reports a missing monitor when the patch is valid', async () => {
    const response = await gql(`mutation {
      updateMonitor(id: "${MISSING_ID}", input: { name: "Renamed" }) { id }
    }`)

    expect(response.body.errors[0].extensions.code).toBe('NOT_FOUND')
  })
})
