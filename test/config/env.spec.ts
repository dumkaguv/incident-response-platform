import { describe, expect, it } from 'vitest'

import { envSchema } from '@/core/config/env.schema'

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/app'

function parse(overrides: Record<string, string> = {}) {
  return envSchema.parse({ DATABASE_URL, ...overrides })
}

describe('envSchema', () => {
  it('coerces numeric strings into numbers', () => {
    const env = parse({ PORT: '3001', THROTTLE_BURST_LIMIT: '42' })

    expect(env.PORT).toBe(3001)
    expect(env.THROTTLE_BURST_LIMIT).toBe(42)
  })

  it('falls back to defaults when a variable is absent', () => {
    const env = parse()

    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.THROTTLE_HTTP_LIMIT).toBe(600)
  })

  it('treats a present-but-empty variable as absent', () => {
    const env = parse({ PORT: '', GRAPHIQL: '', TRUST_PROXY: '' })

    expect(env.PORT).toBe(3000)
    expect(env.GRAPHIQL).toBeUndefined()
    expect(env.TRUST_PROXY).toBeUndefined()
  })

  it('reads booleans from the usual spellings', () => {
    expect(parse({ GRAPHIQL: 'true' }).GRAPHIQL).toBe(true)
    expect(parse({ GRAPHIQL: '1' }).GRAPHIQL).toBe(true)
    expect(parse({ GRAPHIQL: 'false' }).GRAPHIQL).toBe(false)
    expect(parse({ GRAPHIQL: '0' }).GRAPHIQL).toBe(false)
  })

  it('refuses a limit that is not a positive integer', () => {
    expect(() => parse({ THROTTLE_BURST_LIMIT: 'many' })).toThrow()
    expect(() => parse({ THROTTLE_BURST_LIMIT: '0' })).toThrow()
    expect(() => parse({ THROTTLE_BURST_LIMIT: '-5' })).toThrow()
    expect(() => parse({ THROTTLE_BURST_LIMIT: '1.5' })).toThrow()
  })

  it('refuses a missing or malformed database url', () => {
    expect(() => envSchema.parse({})).toThrow()
    expect(() => parse({ DATABASE_URL: 'not-a-url' })).toThrow()
  })

  it('refuses an unknown NODE_ENV', () => {
    expect(() => parse({ NODE_ENV: 'staging' })).toThrow()
  })

  it('drops variables it does not declare', () => {
    expect(parse({ SOMETHING_ELSE: 'x' })).not.toHaveProperty('SOMETHING_ELSE')
  })
})
