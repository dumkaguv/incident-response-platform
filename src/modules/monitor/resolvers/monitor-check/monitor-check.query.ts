import { MonitorTypeName } from '@/modules/monitor/constants'
import { CheckErrorType, MonitorStatus } from '@/modules/monitor/types'
import type { QueryDefinition } from '@/core/pagination'

export const monitorCheckQuery: QueryDefinition = {
  name: MonitorTypeName.check,
  fields: {
    id: { type: 'id' },
    monitorId: { type: 'id', sortable: false },
    status: {
      type: 'enum',
      enum: { name: MonitorTypeName.status, values: MonitorStatus },
      sortable: false
    },
    statusCode: { type: 'int', nullable: true, sortable: false },
    responseTimeMs: { type: 'int', nullable: true, sortable: false },
    errorType: {
      type: 'enum',
      nullable: true,
      enum: { name: MonitorTypeName.errorType, values: CheckErrorType },
      sortable: false
    },
    errorMessage: { type: 'string', nullable: true, sortable: false },
    checkedAt: { type: 'date' },
    monitor: {
      type: 'relation',
      field: 'monitor',
      fields: {
        id: { type: 'id', sortable: false },
        name: { type: 'string', sortable: false },
        url: { type: 'string', sortable: false },
        isActive: { type: 'boolean', sortable: false }
      }
    }
  },
  searchable: ['monitor.name', 'monitor.url'],
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}
