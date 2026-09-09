import { BadUserInputError } from '@/common/utils/errors'

import type { OrderDirection } from './order-direction'

export type ScalarType =
  | 'string'
  | 'id'
  | 'int'
  | 'float'
  | 'boolean'
  | 'date'
  | 'enum'
export type ScalarQueryField = {
  type: ScalarType
  column?: string
  nullable?: boolean
  filterable?: boolean
  sortable?: boolean
  enum?: { name: string; values: Record<string, string> }
}
export type QueryField =
  | ScalarQueryField
  | { type: 'composite'; fields: QueryFields }
  | {
      type: 'relation'
      field?: string
      many?: boolean
      nullable?: boolean
      fields: QueryFields
    }
export type QueryFields = Record<string, QueryField>
export type OrderByInput = {
  [field: string]: OrderDirection | OrderByInput | null
}
export type QueryDefinition = {
  name: string
  fields: QueryFields
  searchable?: string[]
  defaultOrderBy?: OrderByInput[]
  uniqueField?: string
}
export type RelationStep = { field: string; nullable: boolean; many: boolean }
export type ResolvedQueryField = {
  name: string
  column: string
  scalar: ScalarQueryField
  relations: RelationStep[]
}

export function fieldIsNullable(field: ResolvedQueryField): boolean {
  return (
    Boolean(field.scalar.nullable) ||
    field.relations.some((relation) => relation.nullable)
  )
}

export function isQueryObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  )
}

export function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null
}

export function queryField(fields: QueryFields, name: string): QueryField {
  if (!Object.hasOwn(fields, name)) {
    throw new BadUserInputError(`Unknown query field "${name}"`)
  }

  return fields[name]
}

export function resolveQueryField(
  definition: QueryDefinition,
  path: string
): ResolvedQueryField {
  const parts = path.split('.')
  const relations: RelationStep[] = []
  let fields = definition.fields

  for (const [index, part] of parts.entries()) {
    const field = queryField(fields, part)

    if (field.type === 'composite' || field.type === 'relation') {
      if (field.type === 'relation') {
        relations.push({
          field: field.field ?? part,
          nullable: field.nullable ?? false,
          many: field.many ?? false
        })
      }

      fields = field.fields
      continue
    }

    if (index === parts.length - 1) {
      return {
        name: path,
        column: field.column ?? part,
        scalar: field,
        relations
      }
    }

    break
  }

  throw new BadUserInputError(`Expected a scalar field at "${path}"`)
}

export function validateQueryDefinition(definition: QueryDefinition): void {
  function visit(fields: QueryFields, depth: number): void {
    if (depth > 8) {
      throw new Error('Query definitions support at most 8 nested field groups')
    }

    for (const [name, field] of Object.entries(fields)) {
      if (
        !/^[_A-Za-z][_0-9A-Za-z]*$/.test(name) ||
        [
          'and',
          'or',
          'not',
          'some',
          'every',
          'none',
          '__proto__',
          'constructor',
          'prototype'
        ].includes(name) ||
        name.startsWith('__')
      ) {
        throw new Error(`Invalid query field name "${name}"`)
      }

      if (field.type === 'composite' || field.type === 'relation') {
        visit(field.fields, depth + 1)
      } else if (field.type === 'enum' && !field.enum) {
        throw new Error(`Enum field "${name}" must declare its name and values`)
      }
    }
  }

  visit(definition.fields, 0)
  const unique = resolveQueryField(definition, definition.uniqueField ?? 'id')

  if (unique.relations.length || unique.scalar.nullable) {
    throw new Error(
      'The unique pagination field must be a non-null root scalar'
    )
  }

  for (const path of definition.searchable ?? []) {
    if (resolveQueryField(definition, path).scalar.type !== 'string') {
      throw new Error(`Search field "${path}" must be a string`)
    }
  }
}
