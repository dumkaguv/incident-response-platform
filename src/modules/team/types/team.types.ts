import { contractEnum } from '@/prisma/utils/enums'
import type { FieldOutputTypes } from '@/prisma/contract'

export type Team = FieldOutputTypes['public']['Team']
export type TeamMember = FieldOutputTypes['public']['TeamMember']

export type TeamRole = TeamMember['role']

export const TeamRole = contractEnum('TeamRole')
