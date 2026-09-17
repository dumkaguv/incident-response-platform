import { performance } from 'node:perf_hooks'

import {
  type Monitor,
  CheckErrorType,
  MonitorStatus
} from '@/modules/monitor/types'
import {
  classifyProbeError,
  probeErrorMessage
} from '@/modules/monitor/utils/classify-probe-error'

export type ProbeOutcome = {
  status: MonitorStatus
  statusCode: number | null
  responseTimeMs: number | null
  errorType: CheckErrorType | null
  errorMessage: string | null
}

async function drain(response: Response): Promise<void> {
  await response.arrayBuffer()
}

function accepts(monitor: Monitor, status: number): boolean {
  return (
    status >= monitor.expectedStatusMin && status <= monitor.expectedStatusMax
  )
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

    if (accepts(monitor, response.status)) {
      return {
        status: MonitorStatus.UP,
        statusCode: response.status,
        responseTimeMs,
        errorType: null,
        errorMessage: null
      }
    }

    return {
      status: MonitorStatus.DOWN,
      statusCode: response.status,
      responseTimeMs,
      errorType: CheckErrorType.INVALID_STATUS_CODE,
      errorMessage: `expected ${String(monitor.expectedStatusMin)}-${String(monitor.expectedStatusMax)}`
    }
  } catch (error) {
    return {
      status: MonitorStatus.DOWN,
      statusCode: null,
      responseTimeMs: elapsed(),
      errorType: classifyProbeError(error),
      errorMessage: probeErrorMessage(error)
    }
  } finally {
    clearTimeout(timer)
  }
}
