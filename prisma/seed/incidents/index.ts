import type { Db } from '@/prisma/utils/db'

import type { SeededTeam } from '../teams'

import { incidentSeeds } from './incidents.data'

export async function seedIncidents(
  db: Db,
  teams: SeededTeam[]
): Promise<number> {
  const incidents = db.orm.public.Incident

  await incidents.createAll(
    incidentSeeds.map((incident, index) => ({
      ...incident,
      teamId: teams.length ? teams[index % teams.length].id : null
    }))
  )

  const { total } = await incidents.aggregate((aggregate) => ({
    total: aggregate.count()
  }))

  return total
}
