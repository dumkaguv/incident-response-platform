import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '@/app/app.module'

type Server = Parameters<typeof request>[0]

const MISSING_ID = '00000000-0000-0000-0000-000000000000'

describe('the application surface', () => {
  let app: INestApplication

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = fixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ transform: true }))
    await app.init()
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
