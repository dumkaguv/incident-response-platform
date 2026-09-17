import { contractEnum } from '@/core/prisma/utils/enums'
import type { FieldOutputTypes } from '@/core/prisma/contract'

export type MonitorCheck = FieldOutputTypes['public']['MonitorCheck']

export type MonitorStatus = MonitorCheck['status']
export type CheckErrorType = NonNullable<MonitorCheck['errorType']>

export const MonitorStatus = contractEnum('MonitorStatus')
export const CheckErrorType = contractEnum('CheckErrorType')

export type MonitorCheckCreateData = {
  monitorId: string
  status: MonitorStatus
  statusCode?: number | null
  responseTimeMs?: number | null
  errorType?: CheckErrorType | null
  errorMessage?: string | null
}
