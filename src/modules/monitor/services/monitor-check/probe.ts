import { performance } from 'node:perf_hooks'

import {
  type Monitor,
  CheckErrorType,
  MonitorStatus
} from '@/modules/monitor/types'

export type ProbeOutcome = {
  status: MonitorStatus
  statusCode: number | null
  responseTimeMs: number | null
  errorType: CheckErrorType | null
}

const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_FAIL'])

const TLS_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
])

function stringProperty(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return null
  }

  const held = (value as Record<string, unknown>)[key]

  return typeof held === 'string' ? held : null
}

function errorCode(error: unknown): string | null {
  const cause = error instanceof Error ? error.cause : null

  return stringProperty(cause, 'code') ?? stringProperty(error, 'code')
}

function classify(error: unknown): CheckErrorType {
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

  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return CheckErrorType.CONNECTION_REFUSED
  }

  return TLS_CODES.has(code) || code.startsWith('ERR_TLS')
    ? CheckErrorType.TLS_ERROR
    : CheckErrorType.UNKNOWN
}

async function drain(response: Response): Promise<void> {
  await response.arrayBuffer()
}

export async function probe(monitor: Monitor): Promise<ProbeOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, monitor.timeoutMs)
  const started = performance.now()

  function elapsed(): number {
    return Math.round(performance.now() - started)
  }

  try {
    const response = await fetch(monitor.url, {
      method: monitor.method,
      signal: controller.signal,
      redirect: 'follow'
    })
    const responseTimeMs = elapsed()

    await drain(response)

    if (response.status === monitor.expectedStatusCode) {
      return {
        status: MonitorStatus.UP,
        statusCode: response.status,
        responseTimeMs,
        errorType: null
      }
    }

    return {
      status: MonitorStatus.DOWN,
      statusCode: response.status,
      responseTimeMs,
      errorType: CheckErrorType.INVALID_STATUS_CODE
    }
  } catch (error) {
    return {
      status: MonitorStatus.DOWN,
      statusCode: null,
      responseTimeMs: elapsed(),
      errorType: classify(error)
    }
  } finally {
    clearTimeout(timer)
  }
}
