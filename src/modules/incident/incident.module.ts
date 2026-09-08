import { Module } from '@nestjs/common'

import { TeamModule } from '@/modules/team/team.module'

import { IncidentPrismaRepository } from './repositories/incident.prisma.repository'
import { IncidentRepositoryInterface } from './repositories/incident.repository.interface'
import { IncidentResolver } from './resolvers/incident.resolver'
import { TeamIncidentsResolver } from './resolvers/team-incidents.resolver'
import { IncidentService } from './services/incident.service'

@Module({
  imports: [TeamModule],
  providers: [
    {
      provide: IncidentRepositoryInterface,
      useClass: IncidentPrismaRepository
    },
    IncidentService,
    IncidentResolver,
    TeamIncidentsResolver
  ]
})
export class IncidentModule {}
