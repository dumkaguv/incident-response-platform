import { contractEnum } from '@/core/prisma/utils/enums'
import type { FieldOutputTypes } from '@/core/prisma/contract'

export type Monitor = FieldOutputTypes['public']['Monitor']
export type MonitorCheck = FieldOutputTypes['public']['MonitorCheck']

export type MonitorMethod = Monitor['method']
export type MonitorStatus = MonitorCheck['status']
export type CheckErrorType = NonNullable<MonitorCheck['errorType']>

export const MonitorMethod = contractEnum('MonitorMethod')
export const MonitorStatus = contractEnum('MonitorStatus')
export const CheckErrorType = contractEnum('CheckErrorType')
