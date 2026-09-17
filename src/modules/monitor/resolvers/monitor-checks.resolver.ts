import { NestedConnection } from '@/core/graphql'

import { MonitorCheckConnection, MonitorObject } from '../models'

import { monitorCheckQuery } from './monitor-check.query'

export const MonitorChecksResolver = NestedConnection({
  parent: MonitorObject,
  field: 'checks',
  connection: MonitorCheckConnection,
  definition: monitorCheckQuery,
  model: 'MonitorCheck',
  foreignKey: 'monitorId',
  description: 'Probes recorded for this monitor, newest first'
})
