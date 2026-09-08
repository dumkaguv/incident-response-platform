import type { Db } from '@/prisma/utils/db'

import { teamSeeds } from './teams.data'

export type SeededTeam = { id: string; name: string }

export async function seedTeams(db: Db): Promise<SeededTeam[]> {
  const teams = db.orm.public.Team

  await teams.createAll(teamSeeds)

  const rows = await teams.orderBy((fields) => fields.name.asc()).all()

  return rows.map((row) => ({ id: row.id, name: row.name }))
}
