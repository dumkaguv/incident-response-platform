import type { Db } from './db'

export type RawRow = Record<string, unknown>

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
