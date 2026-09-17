import { describe, expect, it } from 'vitest'

import { CheckErrorType } from '@/modules/monitor/types'
import { classifyProbeError } from '@/modules/monitor/utils'

function withCode(code: string): Error {
  return new Error('fetch failed', {
    cause: Object.assign(new Error(code), { code })
  })
}

describe('classifyProbeError', () => {
  it('reads an abort as a timeout', () => {
    expect(
      classifyProbeError(
        Object.assign(new Error('aborted'), { name: 'AbortError' })
      )
    ).toBe(CheckErrorType.TIMEOUT)
  })

  it.each([
    ['ENOTFOUND', CheckErrorType.DNS_ERROR],
    ['EAI_AGAIN', CheckErrorType.DNS_ERROR],
    ['EAI_FAIL', CheckErrorType.DNS_ERROR],
    ['ECONNREFUSED', CheckErrorType.CONNECTION_REFUSED],
    ['ECONNRESET', CheckErrorType.CONNECTION_REFUSED],
    ['CERT_HAS_EXPIRED', CheckErrorType.TLS_ERROR],
    ['DEPTH_ZERO_SELF_SIGNED_CERT', CheckErrorType.TLS_ERROR],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', CheckErrorType.TLS_ERROR],
    ['ERR_TLS_CERT_ALTNAME_INVALID', CheckErrorType.TLS_ERROR],
    ['ESOMETHINGELSE', CheckErrorType.UNKNOWN]
  ])('maps %s to %s', (code, expected) => {
    expect(classifyProbeError(withCode(code))).toBe(expected)
  })

  it('digs the code out of the cause, which is where fetch puts it', () => {
    const bare = Object.assign(new Error('boom'), { code: 'ECONNREFUSED' })

    expect(classifyProbeError(bare)).toBe(CheckErrorType.CONNECTION_REFUSED)
    expect(classifyProbeError(withCode('ECONNREFUSED'))).toBe(
      CheckErrorType.CONNECTION_REFUSED
    )
  })

  it('falls back to UNKNOWN when there is no code to read', () => {
    expect(classifyProbeError(new Error('bare'))).toBe(CheckErrorType.UNKNOWN)
    expect(classifyProbeError('a string')).toBe(CheckErrorType.UNKNOWN)
    expect(classifyProbeError(null)).toBe(CheckErrorType.UNKNOWN)
  })
})
