import { BadUserInputError } from '@/common/utils'

import contractJson from '../contract.json' with { type: 'json' }

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

const primaryKeys = contractJson.storage.namespaces.public.entries
  .table as unknown as Record<string, { primaryKey: { columns: string[] } }>

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

export function primaryKeyOf(model: string): { field: string; column: string } {
  const meta = modelMeta(model)
  const [column] = primaryKeys[meta.storage.table].primaryKey.columns
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
