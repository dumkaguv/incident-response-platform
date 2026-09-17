import { TeamTypeName } from '@/modules/team/constants'
import { TeamRole } from '@/modules/team/types'
import type { QueryDefinition } from '@/core/pagination'

import { IncidentTypeName } from '../constants'
import { IncidentSeverity, IncidentStatus } from '../types'

export const incidentQuery: QueryDefinition = {
  name: IncidentTypeName.incident,
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
      enum: { name: IncidentTypeName.status, values: IncidentStatus },
      filterable: true,
      sortable: true
    },
    severity: {
      type: 'enum',
      enum: { name: IncidentTypeName.severity, values: IncidentSeverity },
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
        createdAt: { type: 'date', filterable: true, sortable: true },
        members: {
          type: 'relation',
          many: true,
          fields: {
            id: { type: 'id', filterable: true },
            name: { type: 'string', filterable: true },
            email: { type: 'string', filterable: true },
            role: {
              type: 'enum',
              enum: { name: TeamTypeName.role, values: TeamRole },
              filterable: true
            }
          }
        }
      }
    }
  },
  searchable: ['title', 'description', 'team.name', 'team.members.name']
}
