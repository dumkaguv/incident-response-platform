import { CheckErrorType } from '@/modules/monitor/types'

const MESSAGE_MAX = 200

const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_FAIL'])

const REFUSED_CODES = new Set(['ECONNREFUSED'])

const CONNECTION_CODES = new Set([
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_SOCKET'
])

const TLS_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
])

function stringProperty(value: unknown, key: string): string | null {
  const held = (value as Record<string, unknown> | null | undefined)?.[key]

  return typeof held === 'string' ? held : null
}

function errorCode(error: unknown): string | null {
  const cause = error instanceof Error ? error.cause : null

  return stringProperty(cause, 'code') ?? stringProperty(error, 'code')
}

export function classifyProbeError(error: unknown): CheckErrorType {
  if (stringProperty(error, 'name') === 'AbortError') {
    return CheckErrorType.TIMEOUT
  }

  const code = errorCode(error)

  if (code === null) {
    return CheckErrorType.UNKNOWN
  }

  if (DNS_CODES.has(code)) {
    return CheckErrorType.DNS_ERROR
  }

  if (REFUSED_CODES.has(code)) {
    return CheckErrorType.CONNECTION_REFUSED
  }

  if (TLS_CODES.has(code) || code.startsWith('ERR_TLS')) {
    return CheckErrorType.TLS_ERROR
  }

  return CONNECTION_CODES.has(code)
    ? CheckErrorType.CONNECTION_ERROR
    : CheckErrorType.UNKNOWN
}

export function probeErrorMessage(error: unknown): string | null {
  return (
    errorCode(error) ??
    stringProperty(error, 'message')?.slice(0, MESSAGE_MAX) ??
    null
  )
}
