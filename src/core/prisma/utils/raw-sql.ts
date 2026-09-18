import { storageFields, tableOf } from './contract-meta'
import type { Db } from './db'

export type RawRow = Record<string, unknown>

export const Codec = {
  text: 'pg/text@1',
  int: 'pg/int4@1',
  timestamp: 'pg/timestamptz-string@1'
} as const

const IDENTIFIER = Symbol('sql identifier')

export type SqlIdentifier = { readonly [IDENTIFIER]: string }

export type SqlColumns<Row> = { readonly [K in keyof Row]-?: SqlIdentifier }

function identifier(name: string): SqlIdentifier {
  return { [IDENTIFIER]: `"${name}"` }
}

function isIdentifier(part: unknown): part is SqlIdentifier {
  return typeof part === 'object' && part !== null && IDENTIFIER in part
}

export function sqlModel<Row>(model: string): [SqlIdentifier, SqlColumns<Row>] {
  const columns = Object.fromEntries(
    Object.entries(storageFields(model)).map(([field, storage]) => [
      field,
      identifier(storage.column)
    ])
  ) as SqlColumns<Row>

  return [identifier(tableOf(model)), columns]
}

export function tagged(parts: readonly string[]): TemplateStringsArray {
  return Object.assign(parts.slice(), { raw: parts.slice() })
}

export function separators(count: number, separator = ', '): string[] {
  return Array.from({ length: Math.max(0, count - 1) }, () => separator)
}

export async function rawRows(
  db: Db,
  parts: readonly string[],
  values: readonly unknown[],
  columns: Record<string, string>
): Promise<RawRow[]> {
  const rows: RawRow[] = []
  const plan = db.raw
    .sql(tagged(parts), ...(values as never[]))
    .returnsRow(columns as never)
    .build()

  for await (const row of db.runtime().query(plan)) {
    rows.push(row)
  }

  return rows
}

export function sqlRows(
  db: Db,
  columns: Record<string, string>
): (strings: TemplateStringsArray, ...parts: unknown[]) => Promise<RawRow[]> {
  return (strings, ...parts) => {
    const fragments: string[] = []
    const values: unknown[] = []
    let pending = strings[0]

    for (const [index, part] of parts.entries()) {
      const next = strings[index + 1]

      if (isIdentifier(part)) {
        pending += part[IDENTIFIER] + next

        continue
      }

      fragments.push(pending)
      values.push(part)
      pending = next
    }

    fragments.push(pending)

    return rawRows(db, fragments, values, columns)
  }
}
