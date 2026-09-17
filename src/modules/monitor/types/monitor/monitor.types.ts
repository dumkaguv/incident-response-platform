import { contractEnum } from '@/core/prisma/utils/enums'
import type { FieldOutputTypes } from '@/core/prisma/contract'
import type { MonitorCheck } from '@/modules/monitor/types/monitor-check'

export type Monitor = FieldOutputTypes['public']['Monitor']

export type MonitorMethod = Monitor['method']

export const MonitorMethod = contractEnum('MonitorMethod')

export type RecordedOutcome = Pick<
  MonitorCheck,
  'status' | 'statusCode' | 'responseTimeMs' | 'checkedAt'
>
