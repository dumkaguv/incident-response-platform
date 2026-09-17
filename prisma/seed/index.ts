import 'dotenv/config'
import { env } from '@/core/config/env.schema'
import { createDb } from '@/core/prisma/utils/db'

import { seedChecks } from './checks'
import { seedMonitors } from './monitors'
import { resetPublic } from './reset'

async function main(): Promise<void> {
  const db = createDb(env().DATABASE_URL)

  try {
    const cleared = await resetPublic(db)
    const monitors = await seedMonitors(db)
    const checks = await seedChecks(db, monitors)

    console.warn(
      `Cleared ${cleared.join(', ')}; seeded ${String(monitors.length)} monitors and ${String(checks)} checks`
    )
  } finally {
    await db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
