import { describe, expect, it } from 'vitest'

import { envSchema } from '@/core/config/env.schema'

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/app'

function parse(overrides: Record<string, string> = {}) {
  return envSchema.parse({ DATABASE_URL, ...overrides })
}

describe('envSchema', () => {
  it('coerces numeric strings into numbers', () => {
    const env = parse({
      PORT: '3001',
      THROTTLE_BURST_LIMIT: '42',
      THROTTLE_WRITE_BURST_LIMIT: '7'
    })

    expect(env.PORT).toBe(3001)
    expect(env.THROTTLE_BURST_LIMIT).toBe(42)
    expect(env.THROTTLE_WRITE_BURST_LIMIT).toBe(7)
  })

  it('falls back to defaults when a variable is absent', () => {
    const env = parse()

    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.THROTTLE_HTTP_LIMIT).toBe(600)
    expect(env.THROTTLE_WRITE_BURST_LIMIT).toBe(5)
    expect(env.THROTTLE_WRITE_SUSTAINED_LIMIT).toBe(60)
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

  it('reads TRUST_PROXY as a boolean or an address list', () => {
    expect(parse({ TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true)
    expect(parse({ TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false)
    expect(parse({ TRUST_PROXY: 'loopback' }).TRUST_PROXY).toBe('loopback')
    expect(parse({ TRUST_PROXY: '10.0.0.0/8, 127.0.0.1' }).TRUST_PROXY).toBe(
      '10.0.0.0/8, 127.0.0.1'
    )
  })

  it('refuses a TRUST_PROXY hop count, which cannot validate the peer', () => {
    expect(() => parse({ TRUST_PROXY: '1' })).toThrow()
    expect(() => parse({ TRUST_PROXY: '2' })).toThrow()
    expect(() => parse({ TRUST_PROXY: '-1' })).toThrow()
    expect(() => parse({ TRUST_PROXY: '1.5' })).toThrow()
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
