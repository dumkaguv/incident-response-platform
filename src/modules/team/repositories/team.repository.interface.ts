import type { Team, TeamMember } from '../types/team.types'

export abstract class TeamRepositoryInterface {
  public abstract findByIds(ids: readonly string[]): Promise<Team[]>

  public abstract findMembersByTeamIds(
    ids: readonly string[]
  ): Promise<TeamMember[]>
}
