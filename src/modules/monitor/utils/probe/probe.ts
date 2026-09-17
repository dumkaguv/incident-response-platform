import { performance } from 'node:perf_hooks'

import {
  type Monitor,
  CheckErrorType,
  MonitorStatus
} from '@/modules/monitor/types'
import { classifyProbeError } from '@/modules/monitor/utils/classify-probe-error'

export type ProbeOutcome = {
  status: MonitorStatus
  statusCode: number | null
  responseTimeMs: number | null
  errorType: CheckErrorType | null
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
      errorType: classifyProbeError(error)
    }
  } finally {
    clearTimeout(timer)
  }
}
