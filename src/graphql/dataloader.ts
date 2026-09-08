import DataLoader from 'dataloader'
import type { GraphQLResolveInfo } from 'graphql'

import { GqlContext } from './graphql-context'

export type BatchFetch<TKey, TRow> = (
  keys: readonly TKey[]
) => Promise<readonly TRow[]>

export type RelationGroup<TKey, TRow> = {
  fetch: BatchFetch<TKey, TRow>
  identify: (row: TRow) => TKey | null | undefined
}

type Identified<TKey> = { id: TKey }

export function getLoader<TKey, TValue>(
  context: GqlContext,
  cacheKey: string,
  batch: (keys: readonly TKey[]) => Promise<TValue[]>
): DataLoader<TKey, TValue> {
  let loader = context.loaders.get(cacheKey)

  if (!loader) {
    loader = new DataLoader<TKey, TValue>(batch)
    context.loaders.set(cacheKey, loader)
  }

  return loader as DataLoader<TKey, TValue>
}

export function loadRelation<TRow extends Identified<TKey>, TKey = string>(
  context: GqlContext,
  info: GraphQLResolveInfo,
  key: NoInfer<TKey> | null | undefined,
  source: BatchFetch<TKey, TRow> | RelationGroup<TKey, TRow>
): Promise<TRow | null> {
  if (key === null || key === undefined) {
    return Promise.resolve(null)
  }

  const { fetch, identify } =
    typeof source === 'function'
      ? { fetch: source, identify: (row: TRow) => row.id }
      : source

  return getLoader<TKey, TRow | null>(context, fieldKey(info), async (keys) => {
    const rows = await fetch(keys)
    const byKey = new Map(rows.map((row) => [identify(row), row]))

    return keys.map((each) => byKey.get(each) ?? null)
  }).load(key)
}

export function loadRelations<TRow, TKey = string>(
  context: GqlContext,
  info: GraphQLResolveInfo,
  key: NoInfer<TKey>,
  { fetch, identify }: RelationGroup<TKey, TRow>
): Promise<TRow[]> {
  return getLoader<TKey, TRow[]>(context, fieldKey(info), async (keys) => {
    const byKey = new Map(keys.map((each) => [each, [] as TRow[]]))

    for (const row of await fetch(keys)) {
      const rowKey = identify(row)

      if (rowKey !== null && rowKey !== undefined) {
        byKey.get(rowKey)?.push(row)
      }
    }

    return keys.map((each) => byKey.get(each) ?? [])
  }).load(key)
}

function fieldKey(info: GraphQLResolveInfo): string {
  return `${info.parentType.name}.${info.fieldName}`
}
