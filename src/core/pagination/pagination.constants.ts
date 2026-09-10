import type { OrderByInput } from './utils/query-definition'

export const DEFAULT_FIRST = 10
export const MAX_FIRST = 100
export const MAX_PREFERENCE = 100

export const DEFAULT_ORDER_BY: OrderByInput[] = [
  { createdAt: 'DESC' },
  { id: 'DESC' }
]
