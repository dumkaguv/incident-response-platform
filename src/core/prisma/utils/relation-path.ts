import type { SortClause } from '@/core/pagination/utils/query-spec'

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

export function collectJoinPaths(sort: readonly SortClause[]): RelationPath[] {
  const found = new Map<string, RelationPath>()

  for (const clause of sort) {
    const path = clause.field.relations.map((relation) => relation.field)

    for (let length = 1; length <= path.length; length++) {
      const prefix = path.slice(0, length)

      found.set(prefix.join('.'), prefix)
    }
  }

  return [...found.values()].sort((left, right) => left.length - right.length)
}
