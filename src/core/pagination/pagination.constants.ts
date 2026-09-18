import type { OrderByInput } from './utils/query-definition'

export const DEFAULT_FIRST = 25
export const DEFAULT_NESTED_FIRST = 10
export const MAX_FIRST = 100
export const MAX_PREFERENCE = 100

export const MIN_SEARCH_TERM = 3
export const MAX_SEARCH_TERM = 200

export const MAX_FILTER_LIST = 1_000
export const MAX_FILTER_VALUES = 2_000

export const DEFAULT_ORDER_BY: OrderByInput[] = [
  { createdAt: 'DESC' },
  { id: 'DESC' }
]
