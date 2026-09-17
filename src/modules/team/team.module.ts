import { Module } from '@nestjs/common'

import { TeamRepository } from './repositories'
import { TeamResolver } from './resolvers'

@Module({
  providers: [TeamRepository, TeamResolver],
  exports: [TeamRepository]
})
export class TeamModule {}
