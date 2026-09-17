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
    url: { type: 'string' },
    method: {
      type: 'enum',
      enum: { name: MonitorTypeName.method, values: MonitorMethod }
    },
    intervalSeconds: { type: 'int' },
    timeoutMs: { type: 'int' },
    expectedStatusMin: { type: 'int' },
    expectedStatusMax: { type: 'int' },
    isActive: { type: 'boolean' },
    nextCheckAt: { type: 'date' },
    lastStatus: {
      type: 'enum',
      nullable: true,
      enum: { name: MonitorTypeName.status, values: MonitorStatus }
    },
    lastCheckedAt: { type: 'date', nullable: true },
    lastStatusCode: { type: 'int', nullable: true },
    lastResponseTimeMs: { type: 'int', nullable: true },
    consecutiveFailures: { type: 'int' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
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
