import type { CheckErrorType, MonitorStatus } from '../types'

export type MonitorCheckCreateData = {
  monitorId: string
  status: MonitorStatus
  statusCode?: number | null
  responseTimeMs?: number | null
  errorType?: CheckErrorType | null
}
