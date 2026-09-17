import type { QueryDefinition } from '@/core/pagination'

import { MonitorTypeName } from '../constants'
import { CheckErrorType, MonitorMethod, MonitorStatus } from '../types'

export const monitorQuery: QueryDefinition = {
  name: MonitorTypeName.monitor,
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    name: { type: 'string', filterable: true, sortable: true },
    url: { type: 'string', filterable: true, sortable: true },
    method: {
      type: 'enum',
      enum: { name: MonitorTypeName.method, values: MonitorMethod },
      filterable: true,
      sortable: true
    },
    intervalSeconds: { type: 'int', filterable: true, sortable: true },
    timeoutMs: { type: 'int', filterable: true, sortable: true },
    expectedStatusCode: { type: 'int', filterable: true, sortable: true },
    isActive: { type: 'boolean', filterable: true, sortable: true },
    nextCheckAt: {
      type: 'date',
      nullable: true,
      filterable: true,
      sortable: true
    },
    createdAt: { type: 'date', filterable: true, sortable: true },
    updatedAt: { type: 'date', filterable: true, sortable: true },
    checks: {
      type: 'relation',
      field: 'checks',
      many: true,
      fields: {
        id: { type: 'id', filterable: true },
        status: {
          type: 'enum',
          enum: { name: MonitorTypeName.status, values: MonitorStatus },
          filterable: true
        },
        statusCode: { type: 'int', nullable: true, filterable: true },
        errorType: {
          type: 'enum',
          nullable: true,
          enum: { name: MonitorTypeName.errorType, values: CheckErrorType },
          filterable: true
        },
        checkedAt: { type: 'date', filterable: true }
      }
    }
  },
  searchable: ['name', 'url']
}
