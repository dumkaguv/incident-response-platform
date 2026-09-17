import { BadUserInputError } from '@/common/utils'
import contractJson from '@/core/prisma/contract.json' with { type: 'json' }

export type RelationMeta = {
  cardinality: string
  on: { localFields: string[]; targetFields: string[] }
  to: { model: string; namespace: string }
}

type ModelMeta = {
  relations?: Record<string, RelationMeta>
  storage: { table: string; fields: Record<string, { column: string }> }
}

const models = contractJson.domain.namespaces.public
  .models as unknown as Record<string, ModelMeta>

type ColumnDefault = { kind: string; value?: unknown }

type TableMeta = {
  primaryKey: { columns: string[] }
  columns: Record<string, { default?: ColumnDefault }>
}

const tables = contractJson.storage.namespaces.public.entries
  .table as unknown as Record<string, TableMeta>

function modelMeta(model: string): ModelMeta {
  const meta = models[model]

  if (!meta) {
    throw new Error(`Model "${model}" is not declared in the contract`)
  }

  return meta
}

export function tableOf(model: string): string {
  return modelMeta(model).storage.table
}

export function columnOf(model: string, field: string): string {
  return modelMeta(model).storage.fields[field]?.column ?? field
}

export function storageFields(
  model: string
): Record<string, { column: string }> {
  return modelMeta(model).storage.fields
}

export function modelFields(model: string): string[] {
  return Object.keys(modelMeta(model).storage.fields)
}

export function relationsOf(model: string): Record<string, RelationMeta> {
  return modelMeta(model).relations ?? {}
}

export function relationLocalFields(model: string, name: string): string[] {
  return relationsOf(model)[name]?.on.localFields ?? []
}

export function columnDefault<T = unknown>(
  model: string,
  field: string
): T | undefined {
  const fallback =
    tables[tableOf(model)].columns[columnOf(model, field)]?.default

  return fallback?.kind === 'literal' ? (fallback.value as T) : undefined
}

export function primaryKeyOf(model: string): { field: string; column: string } {
  const meta = modelMeta(model)
  const [column] = tables[meta.storage.table].primaryKey.columns
  const entry = Object.entries(meta.storage.fields).find(
    ([, storage]) => storage.column === column
  )

  return { field: entry?.[0] ?? column, column }
}

export function relationMeta(model: string, name: string): RelationMeta {
  const relation = relationsOf(model)[name]

  if (!relation) {
    throw new BadUserInputError(
      `Relation "${name}" is not declared on "${model}"`
    )
  }

  return relation
}

export function isToMany(relation: RelationMeta): boolean {
  return relation.cardinality !== 'N:1' && relation.cardinality !== '1:1'
}
