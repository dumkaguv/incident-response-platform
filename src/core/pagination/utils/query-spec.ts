import type { SortDirectionValue } from './order-direction'
import type { ResolvedQueryField } from './query-definition'

export type { OrderDirection, SortDirectionValue } from './order-direction'

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'in'
  | 'nin'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'

export type FilterNode =
  | { kind: 'constant'; value: boolean }
  | {
      kind: 'condition'
      field: string
      operator: FilterOperator
      value: unknown
      nullable?: boolean
    }
  | { kind: 'and' | 'or'; children: FilterNode[] }
  | { kind: 'not'; child: FilterNode }
  | {
      kind: 'relation'
      field: string
      quantifier: 'is' | 'some' | 'every' | 'none'
      child: FilterNode | null
    }
  | {
      kind: 'tuple'
      fields: string[]
      operator: 'lt' | 'gt'
      values: unknown[]
    }

export type SortClause = {
  field: ResolvedQueryField
  direction: SortDirectionValue
  nulls: 'first' | 'last'
}

export type PreferenceSpec = { field: string; ids: string[] }

export type CursorPaginationSpec = {
  limit: number
  direction: 'forward' | 'backward'
  values?: unknown[]
}

export type QuerySpec = {
  filter: FilterNode
  sort: SortClause[]
  preference: PreferenceSpec
  pagination: CursorPaginationSpec
  fingerprint: string
}
