import postgres from '@prisma/orm-postgres/runtime'

import contractJson from '../contract.json' with { type: 'json' }
import type { Contract } from '../contract'

export type Db = ReturnType<typeof postgres<Contract>>

export function createDb(url: string): Db {
  return postgres<Contract>({ contractJson, url })
}
