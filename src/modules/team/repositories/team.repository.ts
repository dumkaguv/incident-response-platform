import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/core/prisma/prisma.service'

import type { Team, TeamMember } from '../types'

@Injectable()
export class TeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByIds(ids: readonly string[]): Promise<Team[]> {
    const rows = await this.prisma.db.orm.public.Team.where((fields) =>
      fields.id.in([...ids])
    ).all()

    return [...rows]
  }

  public async findMembersByTeamIds(
    ids: readonly string[]
  ): Promise<TeamMember[]> {
    const rows = await this.prisma.db.orm.public.TeamMember.where((fields) =>
      fields.teamId.in([...ids])
    )
      .orderBy((fields) => fields.name.asc())
      .all()

    return [...rows]
  }
}
