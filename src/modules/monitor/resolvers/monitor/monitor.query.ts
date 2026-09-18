import { MonitorTypeName } from '@/modules/monitor/constants'
import {
  CheckErrorType,
  MonitorMethod,
  MonitorStatus
} from '@/modules/monitor/types'
import type { QueryDefinition } from '@/core/pagination'

export const monitorQuery: QueryDefinition = {
  name: MonitorTypeName.monitor,
  fields: {
    id: { type: 'id' },
    name: { type: 'string' },
    url: { type: 'string', sortable: false },
    method: {
      type: 'enum',
      enum: { name: MonitorTypeName.method, values: MonitorMethod },
      sortable: false
    },
    intervalSeconds: { type: 'int', sortable: false },
    timeoutMs: { type: 'int', sortable: false },
    expectedStatusMin: { type: 'int', sortable: false },
    expectedStatusMax: { type: 'int', sortable: false },
    isActive: { type: 'boolean', sortable: false },
    nextCheckAt: { type: 'date', sortable: false },
    lastStatus: {
      type: 'enum',
      nullable: true,
      enum: { name: MonitorTypeName.status, values: MonitorStatus },
      sortable: false
    },
    lastCheckedAt: { type: 'date', nullable: true, sortable: false },
    lastStatusCode: { type: 'int', nullable: true, sortable: false },
    lastResponseTimeMs: { type: 'int', nullable: true, sortable: false },
    consecutiveFailures: { type: 'int', sortable: false },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date', sortable: false },
    checks: {
      type: 'relation',
      field: 'checks',
      many: true,
      fields: {
        id: { type: 'id' },
        status: {
          type: 'enum',
          enum: { name: MonitorTypeName.status, values: MonitorStatus }
        },
        statusCode: { type: 'int', nullable: true },
        errorType: {
          type: 'enum',
          nullable: true,
          enum: { name: MonitorTypeName.errorType, values: CheckErrorType }
        },
        checkedAt: { type: 'date' }
      }
    }
  },
  searchable: ['name', 'url']
}
