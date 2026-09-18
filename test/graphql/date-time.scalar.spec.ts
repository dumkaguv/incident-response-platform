import { Kind } from 'graphql'
import { describe, expect, it } from 'vitest'

import { DateTimeScalar } from '@/core/graphql/scalars/date-time.scalar'

describe('DateTime serialization', () => {
  it('keeps every fractional digit PostgreSQL stored', () => {
    expect(DateTimeScalar.serialize('2026-09-18 09:07:20.120265+00')).toBe(
      '2026-09-18T09:07:20.120265Z'
    )
  })

  it('keeps a non-zero offset as an offset', () => {
    expect(DateTimeScalar.serialize('2026-09-18 11:07:20+02')).toBe(
      '2026-09-18T11:07:20+02:00'
    )
  })

  it('passes an RFC 3339 string through unchanged', () => {
    expect(DateTimeScalar.serialize('2026-09-18T09:07:20.5Z')).toBe(
      '2026-09-18T09:07:20.5Z'
    )
  })

  it('formats a Date as ISO 8601', () => {
    expect(DateTimeScalar.serialize(new Date('2026-09-18T09:07:20.120Z'))).toBe(
      '2026-09-18T09:07:20.120Z'
    )
  })

  it('refuses to invent a value for text that is not a date-time', () => {
    expect(() => DateTimeScalar.serialize('yesterday')).toThrow(
      'cannot serialize'
    )
  })
})

describe('DateTime parsing', () => {
  it.each([
    ['2026-02-28T00:00:00Z', '2026-02-28T00:00:00Z'],
    ['2026-02-28T00:00:00.5+02:00', '2026-02-28T00:00:00.5+02:00'],
    ['2026-02-28T00:00:00.120265+00:00', '2026-02-28T00:00:00.120265Z'],
    ['2026-02-28t00:00:00z', '2026-02-28T00:00:00Z'],
    ['2026-02-28T00:00:00+15:59', '2026-02-28T00:00:00+15:59'],
    ['2026-02-28T00:00:00-15:59', '2026-02-28T00:00:00-15:59']
  ])('accepts %s as %s', (input, normalized) => {
    expect(DateTimeScalar.parseValue(input)).toBe(normalized)
  })

  it.each([
    'March 5, 2020',
    '2026',
    '2026-02-30T00:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-09-18T24:00:00Z',
    '2026-09-18T09:07:20',
    '2026-09-18 09:07:20+00',
    '2026-09-18T12:30:00+99:99',
    '2026-09-18T12:30:00+02:75',
    '2026-09-18T12:30:00+16:00',
    '2026-09-18T12:30:00-16:00',
    ''
  ])('rejects %s', (input) => {
    expect(() => DateTimeScalar.parseValue(input)).toThrow('RFC 3339')
  })

  it('rejects a value that is not a string', () => {
    expect(() => DateTimeScalar.parseValue(1_726_650_440_000)).toThrow(
      'received number'
    )
  })

  it('parses a string literal and rejects any other literal kind', () => {
    expect(
      DateTimeScalar.parseLiteral({
        kind: Kind.STRING,
        value: '2026-09-18T09:07:20Z'
      })
    ).toBe('2026-09-18T09:07:20Z')
    expect(() =>
      DateTimeScalar.parseLiteral({ kind: Kind.INT, value: '1' })
    ).toThrow('string literal')
  })
})
