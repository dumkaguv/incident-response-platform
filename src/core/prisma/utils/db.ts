import postgres from '@prisma/orm-postgres/runtime'

import contractJson from '@/core/prisma/contract.json' with { type: 'json' }
import type { Contract } from '@/core/prisma/contract'

export type Db = ReturnType<typeof postgres<Contract>>

export function createDb(url: string): Db {
  return postgres<Contract>({ contractJson, url })
}
