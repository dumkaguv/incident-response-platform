import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import { env } from '@/core/config/env.schema'

const SQL_FILE = fileURLToPath(new URL('search.sql', import.meta.url))

async function main(): Promise<void> {
  const statements = (await readFile(SQL_FILE, 'utf8'))
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  const client = new Client({ connectionString: env().DATABASE_URL })

  await client.connect()

  try {
    for (const statement of statements) {
      await client.query(statement)
    }

    console.warn(
      `Applied ${String(statements.length)} search-index statement(s)`
    )
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
