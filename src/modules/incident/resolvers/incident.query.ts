import type { QueryDefinition } from '@/common/pagination/utils/query-definition'

import { IncidentSeverity, IncidentStatus } from '../types/incident.types'

export const incidentQuery: QueryDefinition = {
  name: 'Incident',
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    title: { type: 'string', filterable: true, sortable: true },
    description: {
      type: 'string',
      nullable: true,
      filterable: true,
      sortable: true
    },
    status: {
      type: 'enum',
      enum: { name: 'IncidentStatus', values: IncidentStatus },
      filterable: true,
      sortable: true
    },
    severity: {
      type: 'enum',
      enum: { name: 'IncidentSeverity', values: IncidentSeverity },
      filterable: true,
      sortable: true
    },
    createdAt: { type: 'date', filterable: true, sortable: true },
    updatedAt: { type: 'date', filterable: true, sortable: true },
    resolvedAt: {
      type: 'date',
      nullable: true,
      filterable: true,
      sortable: true
    },
    team: {
      type: 'relation',
      field: 'team',
      nullable: true,
      fields: {
        id: { type: 'id', filterable: true, sortable: true },
        name: { type: 'string', filterable: true, sortable: true },
        slug: { type: 'string', filterable: true, sortable: true },
        description: {
          type: 'string',
          nullable: true,
          filterable: true,
          sortable: true
        },
        createdAt: { type: 'date', filterable: true, sortable: true }
      }
    }
  },
  searchable: ['title', 'description', 'team.name']
}
