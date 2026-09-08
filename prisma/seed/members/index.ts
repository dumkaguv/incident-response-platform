import type { Db } from '@/core/prisma/utils/db'

import type { SeededTeam } from '../teams'

import { memberSeeds } from './members.data'

export async function seedMembers(
  db: Db,
  teams: SeededTeam[]
): Promise<number> {
  if (!teams.length) {
    return 0
  }

  const members = db.orm.public.TeamMember

  await members.createAll(
    memberSeeds.map((member, index) => ({
      ...member,
      teamId: teams[index % teams.length].id
    }))
  )

  const { total } = await members.aggregate((aggregate) => ({
    total: aggregate.count()
  }))

  return total
}
