import { describe, expect, it } from 'vitest'

import { MAX_PREFERENCE } from '@/core/pagination/pagination.constants'
import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import {
  decodeCursor,
  encodeCursor
} from '@/core/pagination/utils/query-cursor'
import { specToPrisma } from '@/core/prisma/utils/spec-to-prisma'

import { fixtureQuery } from './fixtures/query-definition'

const PINNED = ['r7', 'r3']

describe('preference', () => {
  it('pins the given ids once, in the order given', () => {
    const spec = normalizeQuery(fixtureQuery, {
      preference: ['r7', 'r3', 'r7']
    })

    expect(spec.preference).toEqual({ field: 'id', ids: PINNED })
  })

  it('records the pinned rank of a row in its cursor and null for the rest', () => {
    const spec = normalizeQuery(fixtureQuery, {
      preference: PINNED,
      orderBy: [{ title: 'ASC' }]
    })
    const pinned = encodeCursor({ id: 'r3', title: 'C' }, spec)
    const unpinned = encodeCursor({ id: 'r9', title: 'I' }, spec)

    expect(
      decodeCursor(pinned, spec.fingerprint, spec.sort, spec.preference)
    ).toEqual([1, 'C', 'r3'])
    expect(
      decodeCursor(unpinned, spec.fingerprint, spec.sort, spec.preference)
    ).toEqual([null, 'I', 'r9'])
  })

  it('binds a cursor to the preference list it was issued under', () => {
    const cursor = encodeCursor(
      { id: 'r3', title: 'C' },
      normalizeQuery(fixtureQuery, {
        preference: PINNED,
        orderBy: [{ title: 'ASC' }]
      })
    )

    expect(() =>
      normalizeQuery(fixtureQuery, {
        preference: ['r3'],
        orderBy: [{ title: 'ASC' }],
        after: cursor
      })
    ).toThrow('Invalid pagination cursor')
    expect(() =>
      normalizeQuery(fixtureQuery, {
        orderBy: [{ title: 'ASC' }],
        after: cursor
      })
    ).toThrow('Invalid pagination cursor')
  })

  it('continues past a pinned row with the later pins and then the unpinned rest', () => {
    const input = { preference: PINNED, orderBy: [{ title: 'ASC' as const }] }
    const cursor = encodeCursor(
      { id: 'r7', title: 'G' },
      normalizeQuery(fixtureQuery, input)
    )
    const { where } = specToPrisma(
      normalizeQuery(fixtureQuery, { ...input, after: cursor })
    ).args

    expect(where).toEqual({
      OR: [
        { OR: [{ id: { in: ['r3'] } }, { id: { notIn: PINNED } }] },
        {
          AND: [{ id: { equals: 'r7' } }, { title: { gt: 'G' } }]
        },
        {
          AND: [
            { id: { equals: 'r7' } },
            { title: { equals: 'G' } },
            { id: { gt: 'r7' } }
          ]
        }
      ]
    })
  })

  it('continues past an unpinned row only through the unpinned rest', () => {
    const input = { preference: PINNED, orderBy: [{ title: 'ASC' as const }] }
    const cursor = encodeCursor(
      { id: 'r9', title: 'I' },
      normalizeQuery(fixtureQuery, input)
    )
    const { where } = specToPrisma(
      normalizeQuery(fixtureQuery, { ...input, after: cursor })
    ).args

    expect(JSON.stringify(where)).not.toContain('"in"')
    expect(where).toMatchObject({
      OR: [
        {
          AND: [{ id: { notIn: PINNED } }, { title: { gt: 'I' } }]
        },
        {
          AND: [
            { id: { notIn: PINNED } },
            { title: { equals: 'I' } },
            { id: { gt: 'r9' } }
          ]
        }
      ]
    })
  })

  it.each([
    [Array.from({ length: MAX_PREFERENCE + 1 }, (_, index) => `r${index}`)],
    [['r1', 7]],
    [['r1', '']],
    ['r1']
  ])('rejects a preference list it cannot pin: %j', (preference) => {
    expect(() => normalizeQuery(fixtureQuery, { preference })).toThrow(
      /preference/
    )
  })
})
