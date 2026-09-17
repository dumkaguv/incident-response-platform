import { MonitorTypeName } from '@/modules/monitor/constants'
import { CheckErrorType, MonitorStatus } from '@/modules/monitor/types'
import type { QueryDefinition } from '@/core/pagination'

export const monitorCheckQuery: QueryDefinition = {
  name: MonitorTypeName.check,
  fields: {
    id: { type: 'id' },
    monitorId: { type: 'id' },
    status: {
      type: 'enum',
      enum: { name: MonitorTypeName.status, values: MonitorStatus }
    },
    statusCode: {
      type: 'int',
      nullable: true
    },
    responseTimeMs: {
      type: 'int',
      nullable: true
    },
    errorType: {
      type: 'enum',
      nullable: true,
      enum: { name: MonitorTypeName.errorType, values: CheckErrorType }
    },
    errorMessage: { type: 'string', nullable: true },
    checkedAt: { type: 'date' },
    monitor: {
      type: 'relation',
      field: 'monitor',
      fields: {
        id: { type: 'id' },
        name: { type: 'string' },
        url: { type: 'string' },
        isActive: { type: 'boolean' }
      }
    }
  },
  searchable: ['monitor.name', 'monitor.url'],
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}
