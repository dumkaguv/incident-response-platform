import type { Connection, QuerySpec } from '@/common/pagination'

import type {
  IncidentCreateData,
  IncidentUpdateData
} from '../inputs/incident.inputs'
import type { Incident } from '../types/incident.types'

export abstract class IncidentRepositoryInterface {
  public abstract list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<Incident>>

  public abstract findById(id: string): Promise<Incident | null>

  public abstract findByTeamIds(ids: readonly string[]): Promise<Incident[]>

  public abstract create(data: IncidentCreateData): Promise<Incident>

  public abstract update(
    id: string,
    data: IncidentUpdateData
  ): Promise<Incident | null>

  public abstract delete(id: string): Promise<Incident | null>
}
