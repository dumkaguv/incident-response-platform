import type { QueryDefinition } from '@/common/pagination/utils/query-definition'

export const fixtureQuery: QueryDefinition = {
  name: 'QueryFixture',
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    title: { type: 'string', filterable: true, sortable: true },
    secret: { type: 'string' },
    rank: { type: 'int', nullable: true, filterable: true, sortable: true },
    active: { type: 'boolean', filterable: true, sortable: true },
    priority: {
      type: 'enum',
      enum: {
        name: 'FixturePriority',
        values: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
      },
      filterable: true,
      sortable: true
    },
    createdAt: { type: 'date', filterable: true, sortable: true },
    location: {
      type: 'composite',
      fields: {
        city: {
          type: 'string',
          column: 'locationCity',
          nullable: true,
          filterable: true,
          sortable: true
        }
      }
    },
    owner: {
      type: 'relation',
      field: 'assignee',
      nullable: true,
      fields: {
        name: {
          type: 'string',
          nullable: true,
          filterable: true,
          sortable: true
        },
        email: { type: 'string', filterable: true, sortable: true },
        organization: {
          type: 'relation',
          nullable: true,
          fields: {
            name: {
              type: 'string',
              nullable: true,
              filterable: true,
              sortable: true
            }
          }
        }
      }
    },
    comments: {
      type: 'relation',
      many: true,
      fields: {
        body: { type: 'string', filterable: true },
        flagged: { type: 'boolean', filterable: true }
      }
    }
  },
  searchable: [
    'title',
    'location.city',
    'owner.name',
    'owner.organization.name',
    'comments.body'
  ],
  defaultOrderBy: [{ createdAt: 'DESC' }]
}
