import { describe, expect, it } from 'vitest'

import { numberSetting } from '@/common/utils'

describe('numberSetting', () => {
  it('reads a numeric string', () => {
    expect(numberSetting('600', 30)).toBe(600)
    expect(numberSetting(' 42 ', 30)).toBe(42)
  })

  it('falls back for an env var that is present but empty', () => {
    expect(numberSetting('', 30)).toBe(30)
    expect(numberSetting('   ', 30)).toBe(30)
  })

  it('falls back for anything that is not a number', () => {
    expect(numberSetting(undefined, 30)).toBe(30)
    expect(numberSetting(null, 30)).toBe(30)
    expect(numberSetting('many', 30)).toBe(30)
    expect(numberSetting({}, 30)).toBe(30)
    expect(numberSetting(Number.NaN, 30)).toBe(30)
    expect(numberSetting(Number.POSITIVE_INFINITY, 30)).toBe(30)
  })

  it('passes a number through', () => {
    expect(numberSetting(5, 30)).toBe(5)
    expect(numberSetting(0, 30)).toBe(0)
  })
})
