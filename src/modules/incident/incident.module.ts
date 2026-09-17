import { Module } from '@nestjs/common'

import { TeamModule } from '@/modules/team/team.module'

import { IncidentRepository } from './repositories'
import { IncidentResolver, TeamIncidentsResolver } from './resolvers'
import { IncidentService } from './services'

@Module({
  imports: [TeamModule],
  providers: [
    IncidentRepository,
    IncidentService,
    IncidentResolver,
    TeamIncidentsResolver
  ]
})
export class IncidentModule {}
