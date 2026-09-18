import { describe, expect, it } from 'vitest'

import { Codec, sqlModel, sqlRows } from '@/core/prisma/utils/raw-sql'
import type { Db } from '@/core/prisma/utils/db'
import type { Monitor } from '@/modules/monitor/types'

type Statement = { sql: string; values: unknown[] }

function fakeDb(rows: Record<string, unknown>[] = []): {
  db: Db
  executed: Statement[]
} {
  const executed: Statement[] = []
  const db = {
    raw: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        returnsRow: () => ({
          build: () => ({ sql: strings.join('?'), values })
        })
      })
    },
    runtime: () => ({
      query: (statement: Statement) => {
        executed.push(statement)

        return (function* answered() {
          yield* rows
        })()
      }
    })
  }

  return { db: db as unknown as Db, executed }
}

const [monitors, field] = sqlModel<Monitor>('Monitor')

describe('sqlTable and sqlColumns', () => {
  it('address the mapped storage names, not the model names', async () => {
    const { db, executed } = fakeDb()

    await sqlRows(db, { id: Codec.text })`
      SELECT ${field.nextCheckAt}, ${field.consecutiveFailures}
      FROM ${monitors}
    `

    expect(executed[0].sql).toContain('"next_check_at"')
    expect(executed[0].sql).toContain('"consecutive_failures"')
    expect(executed[0].sql).toContain('FROM "monitor"')
  })
})

describe('sqlRows', () => {
  it('inlines an identifier into the statement instead of binding it', async () => {
    const { db, executed } = fakeDb()

    await sqlRows(db, { id: Codec.text })`SELECT ${field.id} FROM ${monitors}`

    expect(executed[0].sql).toBe('SELECT "id" FROM "monitor"')
    expect(executed[0].values).toEqual([])
  })

  it('binds a value and leaves a placeholder where it stood', async () => {
    const { db, executed } = fakeDb()

    await sqlRows(db, { id: Codec.text })`WHERE ${field.id} = ${'m1'}`

    expect(executed[0].sql).toBe('WHERE "id" = ?')
    expect(executed[0].values).toEqual(['m1'])
  })

  it('keeps values in source order however many identifiers sit between them', async () => {
    const { db, executed } = fakeDb()

    await sqlRows(db, { id: Codec.text })`
      ${field.id} ${'first'} ${field.nextCheckAt} ${field.isActive} ${'second'}
    `

    expect(executed[0].values).toEqual(['first', 'second'])
    expect(executed[0].sql).toContain('"id" ?')
    expect(executed[0].sql).toContain('"next_check_at" "is_active" ?')
  })

  it('answers no rows without ever binding a stray parameter', async () => {
    const { db, executed } = fakeDb()

    const rows = await sqlRows(db, { id: Codec.text })`SELECT 1`

    expect(rows).toEqual([])
    expect(executed[0].values).toEqual([])
  })
})
