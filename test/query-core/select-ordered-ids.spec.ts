import postgres from '@prisma/orm-postgres/runtime'
import { describe, expect, it } from 'vitest'

import contractJson from '@/core/prisma/contract.json' with { type: 'json' }
import {
  type SqlLaneClient,
  selectOrderedIds
} from '@/core/prisma/utils/relation-query'
import type { Contract } from '@/core/prisma/contract'

const db = postgres<Contract>({
  contractJson,
  url: 'postgresql://unused:unused@127.0.0.1:1/unused'
})

const client = db as unknown as SqlLaneClient

describe('selectOrderedIds', () => {
  it('refuses to join through a to-many relation for ordering', async () => {
    await expect(
      selectOrderedIds(client, 'Monitor', {
        where: {},
        order: [],
        paths: [['checks']],
        take: 10
      })
    ).rejects.toThrow(
      'Ordering through the to-many relation "checks" is not supported'
    )
  })
})
