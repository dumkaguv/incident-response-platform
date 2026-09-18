import { contractEnum } from '@/core/prisma/utils/enums'
import type { FieldOutputTypes } from '@/core/prisma/contract'

export type Monitor = FieldOutputTypes['public']['Monitor']

export type MonitorMethod = Monitor['method']

export const MonitorMethod = contractEnum('MonitorMethod')

export type MonitorDue = {
  id: string
  dueAt: string
}
