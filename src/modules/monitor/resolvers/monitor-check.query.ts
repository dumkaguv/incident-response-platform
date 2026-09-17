import type { QueryDefinition } from '@/core/pagination'

import { MonitorTypeName } from '../constants'
import { CheckErrorType, MonitorStatus } from '../types'

export const monitorCheckQuery: QueryDefinition = {
  name: MonitorTypeName.check,
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    monitorId: { type: 'id', filterable: true, sortable: true },
    status: {
      type: 'enum',
      enum: { name: MonitorTypeName.status, values: MonitorStatus },
      filterable: true,
      sortable: true
    },
    statusCode: {
      type: 'int',
      nullable: true,
      filterable: true,
      sortable: true
    },
    responseTimeMs: {
      type: 'int',
      nullable: true,
      filterable: true,
      sortable: true
    },
    errorType: {
      type: 'enum',
      nullable: true,
      enum: { name: MonitorTypeName.errorType, values: CheckErrorType },
      filterable: true,
      sortable: true
    },
    checkedAt: { type: 'date', filterable: true, sortable: true },
    monitor: {
      type: 'relation',
      field: 'monitor',
      fields: {
        id: { type: 'id', filterable: true, sortable: true },
        name: { type: 'string', filterable: true, sortable: true },
        url: { type: 'string', filterable: true, sortable: true },
        isActive: { type: 'boolean', filterable: true, sortable: true }
      }
    }
  },
  searchable: ['monitor.name', 'monitor.url'],
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}
