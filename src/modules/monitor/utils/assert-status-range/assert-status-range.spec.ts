import { describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/common/utils'
import { assertStatusRange } from '@/modules/monitor/utils'

describe('assertStatusRange', () => {
  it('accepts a range that is the right way round', () => {
    expect(() => {
      assertStatusRange(200, 299)
    }).not.toThrow()
  })

  it('accepts a single code', () => {
    expect(() => {
      assertStatusRange(204, 204)
    }).not.toThrow()
  })

  it('refuses a range that is inverted', () => {
    expect(() => {
      assertStatusRange(400, 200)
    }).toThrow(BadUserInputError)
  })

  it('says nothing when only one bound is known, because the other comes from the row', () => {
    expect(() => {
      assertStatusRange(400, undefined)
    }).not.toThrow()
    expect(() => {
      assertStatusRange(undefined, 200)
    }).not.toThrow()
    expect(() => {
      assertStatusRange(undefined, undefined)
    }).not.toThrow()
  })
})
