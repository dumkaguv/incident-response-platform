import { contractEnum } from '@/core/prisma/utils/enums'
import type { FieldOutputTypes } from '@/core/prisma/contract'

export type Incident = FieldOutputTypes['public']['Incident']

export type IncidentStatus = Incident['status']
export type IncidentSeverity = Incident['severity']

export const IncidentStatus = contractEnum('IncidentStatus')
export const IncidentSeverity = contractEnum('IncidentSeverity')
