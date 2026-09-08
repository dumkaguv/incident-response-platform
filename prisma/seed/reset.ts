import contractJson from '@/core/prisma/contract.json' with { type: 'json' }
import type { Db } from '@/core/prisma/utils/db'

type Relation = { cardinality: string; to: { model: string } }
type Model = { relations?: Record<string, Relation> }
type Models = Record<string, Model>

type Truncatable = {
  where(build: (fields: { id: { isNotNull(): unknown } }) => unknown): {
    deleteAll(): Promise<unknown>
  }
}

export function deleteOrder(models: Models): string[] {
  const order: string[] = []
  const done = new Set<string>()
  const open = new Set<string>()

  function visit(name: string, from: string[]): void {
    if (done.has(name)) {
      return
    }

    if (open.has(name)) {
      throw new Error(
        `cyclic foreign keys between ${[...from, name].join(' -> ')}; truncate those tables explicitly`
      )
    }

    open.add(name)

    for (const relation of Object.values(models[name]?.relations ?? {})) {
      if (relation.cardinality === '1:N') {
        visit(relation.to.model, [...from, name])
      }
    }

    open.delete(name)
    done.add(name)
    order.push(name)
  }

  for (const name of Object.keys(models)) {
    visit(name, [])
  }

  return order
}

export async function resetPublic(db: Db): Promise<string[]> {
  const models = contractJson.domain.namespaces.public.models as Models
  const order = deleteOrder(models)
  const tables = db.orm.public as unknown as Record<string, Truncatable>

  for (const name of order) {
    await tables[name].where((fields) => fields.id.isNotNull()).deleteAll()
  }

  return order
}
