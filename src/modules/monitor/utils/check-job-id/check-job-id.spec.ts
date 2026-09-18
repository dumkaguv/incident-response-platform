import { describe, expect, it } from 'vitest'

import { checkJobId } from '@/modules/monitor/utils'

const MONITOR = '956817d5-5429-4178-a6c2-528b305eaa73'

describe('checkJobId', () => {
  it('carries no colon, which BullMQ refuses in a custom id', () => {
    const id = checkJobId(MONITOR, '2026-09-18 15:38:42.715296+00')

    expect(id).not.toContain(':')
    expect(id).toBe(`${MONITOR}-2026091815384271529600`)
  })

  it('answers the same id for the same slot and a different one for the next', () => {
    const slot = '2026-09-18 15:38:42.715296+00'
    const next = '2026-09-18 15:39:42.715296+00'

    expect(checkJobId(MONITOR, slot)).toBe(checkJobId(MONITOR, slot))
    expect(checkJobId(MONITOR, next)).not.toBe(checkJobId(MONITOR, slot))
  })

  it('separates two monitors sharing one slot', () => {
    const slot = '2026-09-18 15:38:42.715296+00'
    const other = '03047850-2875-426d-abae-a0d322731e8d'

    expect(checkJobId(other, slot)).not.toBe(checkJobId(MONITOR, slot))
  })

  it('reads the text it was handed, so the claimed slot travels verbatim', () => {
    const stored = '2026-09-18 15:38:42.715296+00'
    const rfc = '2026-09-18T15:38:42.715296Z'

    expect(checkJobId(MONITOR, rfc)).not.toBe(checkJobId(MONITOR, stored))
    expect(checkJobId(MONITOR, rfc)).toBe(`${MONITOR}-20260918153842715296`)
  })
})
