import { Module } from '@nestjs/common'

import { TeamPrismaRepository } from './repositories/team.prisma.repository'
import { TeamRepositoryInterface } from './repositories/team.repository.interface'
import { TeamResolver } from './resolvers/team.resolver'

@Module({
  providers: [
    { provide: TeamRepositoryInterface, useClass: TeamPrismaRepository },
    TeamResolver
  ],
  exports: [TeamRepositoryInterface]
})
export class TeamModule {}
