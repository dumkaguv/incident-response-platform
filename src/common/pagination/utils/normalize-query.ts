import {
  DEFAULT_FIRST,
  MAX_FIRST
} from '@/common/pagination/pagination.constants'
import { BadUserInputError } from '@/common/utils/errors'

import { decodeCursor, queryFingerprint } from './query-cursor'
import { type QueryDefinition, isProvided } from './query-definition'
import { group, parseFilter, searchFilter } from './query-filter'
import { parseOrder } from './query-order'
import type { CursorPaginationSpec, QuerySpec } from './query-spec'

export type QueryInput = {
  filter?: unknown
  orderBy?: unknown
  search?: unknown
  first?: number | null
  last?: number | null
  after?: string | null
  before?: string | null
}

function pageSize(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_FIRST) {
    throw new BadUserInputError(
      `Page size must be an integer between 1 and ${MAX_FIRST}`
    )
  }

  return value
}

export function normalizeQuery(
  definition: QueryDefinition,
  input: QueryInput
): QuerySpec {
  const filter = group('and', [
    parseFilter(definition.fields, input.filter),
    searchFilter(definition, input.search)
  ])
  const sort = parseOrder(definition, input.orderBy)
  const fingerprint = queryFingerprint(definition.name, filter, sort)
  const { first, last, after, before } = input

  if (
    (isProvided(first) && isProvided(last)) ||
    (isProvided(after) && isProvided(before)) ||
    (isProvided(first) && isProvided(before)) ||
    (isProvided(last) && isProvided(after))
  ) {
    throw new BadUserInputError(
      'Use first/after for forward pagination or last/before for backward pagination'
    )
  }

  const pagination: CursorPaginationSpec = {
    limit: pageSize(first ?? last ?? DEFAULT_FIRST),
    direction: isProvided(last) || isProvided(before) ? 'backward' : 'forward'
  }
  const cursor = after ?? before

  if (isProvided(cursor)) {
    pagination.values = decodeCursor(cursor, fingerprint, sort)
  }

  return { filter, sort, pagination, fingerprint }
}
