import type { SortClause } from '@/core/pagination/utils/query-spec'

import { isToMany, relationsOf } from './contract-meta'

export type RelationPath = readonly string[]

export function joinAlias(path: RelationPath): string {
  return `j_${path.join('_')}`
}

export function existsAlias(path: RelationPath): string {
  return `x_${path.join('_')}`
}

export function scopeKey(rootTable: string, path: RelationPath): string {
  return path.length ? joinAlias(path) : rootTable
}

export function collectJoinPaths(
  model: string,
  sort: readonly SortClause[],
  where: Record<string, unknown>
): RelationPath[] {
  const found = new Map<string, RelationPath>()

  function add(path: RelationPath): void {
    for (let length = 1; length <= path.length; length++) {
      const prefix = path.slice(0, length)

      found.set(prefix.join('.'), prefix)
    }
  }

  for (const clause of sort) {
    add(clause.field.relations.map((relation) => relation.field))
  }

  function walk(
    current: string,
    path: RelationPath,
    node: Record<string, unknown>
  ): void {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'AND' || key === 'OR') {
        for (const child of value as Record<string, unknown>[]) {
          walk(current, path, child)
        }

        continue
      }

      if (key === 'NOT') {
        walk(current, path, value as Record<string, unknown>)
        continue
      }

      const relation = relationsOf(current)[key]

      if (!relation || isToMany(relation)) {
        continue
      }

      const next = [...path, key]

      add(next)
      for (const child of Object.values(value as Record<string, unknown>)) {
        if (child !== null && typeof child === 'object') {
          walk(relation.to.model, next, child as Record<string, unknown>)
        }
      }
    }
  }

  walk(model, [], where)

  return [...found.values()].sort((left, right) => left.length - right.length)
}
