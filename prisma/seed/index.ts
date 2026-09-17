import 'dotenv/config'
import { env } from '@/core/config/env.schema'
import { createDb } from '@/core/prisma/utils/db'

import { seedIncidents } from './incidents'
import { seedMembers } from './members'
import { resetPublic } from './reset'
import { seedTeams } from './teams'

async function main(): Promise<void> {
  const db = createDb(env().DATABASE_URL)

  try {
    const cleared = await resetPublic(db)
    const teams = await seedTeams(db)
    const incidents = await seedIncidents(db, teams)
    const members = await seedMembers(db, teams)

    console.warn(
      `Cleared ${cleared.join(', ')}; seeded ${String(teams.length)} teams, ${String(incidents)} incidents and ${String(members)} members`
    )
  } finally {
    await db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
