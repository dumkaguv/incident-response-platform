import { describe, expect, it, vi } from 'vitest'

import { Connection } from '@/core/pagination/connection'
import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import {
  decodeCursor,
  encodeCursor
} from '@/core/pagination/utils/query-cursor'
import { validateQueryDefinition } from '@/core/pagination/utils/query-definition'
import { specToPrisma } from '@/core/prisma/utils/spec-to-prisma'

import { fixtureQuery } from './fixtures/query-definition'

describe('query core', () => {
  it('preserves logical groups and maps composite and relation fields', () => {
    const spec = normalizeQuery(fixtureQuery, {
      filter: {
        and: [
          { location: { city: { eq: 'Paris' } } },
          {
            or: [
              { title: { contains: 'OUTAGE' } },
              { owner: { organization: { name: { eq: 'Acme' } } } }
            ]
          },
          { not: { priority: { eq: 'LOW' } } }
        ]
      }
    })

    expect(specToPrisma(spec).countWhere).toEqual({
      AND: [
        { locationCity: { equals: 'Paris' } },
        {
          OR: [
            { title: { contains: 'OUTAGE', mode: 'insensitive' } },
            {
              assignee: {
                is: { organization: { is: { name: { equals: 'Acme' } } } }
              }
            }
          ]
        },
        { NOT: { priority: { equals: 'LOW' } } }
      ]
    })
  })

  it('keeps collection conditions in one some scope', () => {
    const spec = normalizeQuery(fixtureQuery, {
      filter: {
        comments: {
          some: { body: { contains: 'hello' }, flagged: { eq: true } }
        }
      }
    })

    expect(specToPrisma(spec).countWhere).toEqual({
      comments: {
        some: {
          AND: [
            { body: { contains: 'hello', mode: 'insensitive' } },
            { flagged: { equals: true } }
          ]
        }
      }
    })
  })

  it('combines search paths with user filters and hydrates every nested ordering path', () => {
    const spec = normalizeQuery(fixtureQuery, {
      search: '  database  ',
      filter: { active: { eq: true } },
      orderBy: [
        { owner: { name: 'AscNullsLast' } },
        { owner: { organization: { name: 'DescNullsFirst' } } },
        { location: { city: 'ASC' } }
      ]
    })
    const { args, countWhere } = specToPrisma(spec)

    expect(args.orderBy).toEqual([
      { assignee: { name: { sort: 'asc', nulls: 'last' } } },
      {
        assignee: { organization: { name: { sort: 'desc', nulls: 'first' } } }
      },
      { locationCity: { sort: 'asc', nulls: 'last' } },
      { id: 'asc' }
    ])
    expect(args.include).toEqual({
      assignee: {
        select: { name: true, organization: { select: { name: true } } }
      }
    })
    expect(JSON.stringify(countWhere)).toContain(
      '"comments":{"some":{"body":{"contains":"database"'
    )
    expect(JSON.stringify(countWhere)).not.toContain('secret')
    expect(countWhere.AND).toHaveLength(2)
  })

  it('uses explicit empty-group semantics and isolates case-insensitive operators', () => {
    expect(
      specToPrisma(normalizeQuery(fixtureQuery, { filter: { or: [] } }))
        .countWhere
    ).toEqual({ OR: [] })
    expect(
      specToPrisma(normalizeQuery(fixtureQuery, { filter: { not: {} } }))
        .countWhere
    ).toEqual({ OR: [] })
    expect(
      specToPrisma(normalizeQuery(fixtureQuery, { filter: { and: [] } }))
        .countWhere
    ).toEqual({})
    expect(
      specToPrisma(
        normalizeQuery(fixtureQuery, {
          filter: { title: { eq: 'Exact', contains: 'act' } }
        })
      ).countWhere
    ).toEqual({
      AND: [
        { title: { equals: 'Exact' } },
        { title: { contains: 'act', mode: 'insensitive' } }
      ]
    })
  })

  it('binds cursors to the resource, complete order, filter and search', () => {
    const input = {
      orderBy: [{ owner: { name: 'ASC' as const } }],
      filter: { active: { eq: true } },
      search: 'A'
    }
    const spec = normalizeQuery(fixtureQuery, input)
    const cursor = encodeCursor({ id: 'a', assignee: { name: null } }, spec)

    expect(
      normalizeQuery(fixtureQuery, { ...input, after: cursor }).pagination
    ).toMatchObject({ values: [null, 'a'] })
    expect(() =>
      normalizeQuery(fixtureQuery, {
        ...input,
        orderBy: [{ owner: { name: 'DESC' } }],
        after: cursor
      })
    ).toThrow('Invalid pagination cursor')
    expect(() =>
      normalizeQuery(fixtureQuery, { ...input, filter: {}, after: cursor })
    ).toThrow('Invalid pagination cursor')
    expect(() =>
      normalizeQuery(fixtureQuery, { ...input, search: 'B', after: cursor })
    ).toThrow('Invalid pagination cursor')
    expect(() =>
      normalizeQuery(
        { ...fixtureQuery, name: 'Different' },
        { ...input, after: cursor }
      )
    ).toThrow('Invalid pagination cursor')
  })

  it('validates cursor shape, values and selected relation columns', () => {
    const spec = normalizeQuery(fixtureQuery, { orderBy: [{ rank: 'ASC' }] })
    const malformed = Buffer.from(
      JSON.stringify({
        v: 1,
        fingerprint: spec.fingerprint,
        values: ['wrong', 'a']
      })
    ).toString('base64url')

    expect(() => decodeCursor(malformed, spec.fingerprint, spec.sort)).toThrow(
      'Invalid pagination cursor'
    )
    expect(() =>
      decodeCursor('not-a-cursor', spec.fingerprint, spec.sort)
    ).toThrow('Invalid pagination cursor')
    expect(() => encodeCursor({ id: 'a' }, spec)).toThrow(
      'Missing selected cursor field'
    )
    expect(() => normalizeQuery(fixtureQuery, { after: '' })).toThrow(
      'Invalid pagination cursor'
    )
  })

  it('reverses backward scans and counts the entire filtered set', () => {
    const orderBy = [{ rank: 'AscNullsFirst' as const }]
    const base = normalizeQuery(fixtureQuery, { orderBy })
    const before = encodeCursor({ id: 'c', rank: 2 }, base)
    const spec = normalizeQuery(fixtureQuery, { orderBy, before, last: 2 })
    const { args, countWhere } = specToPrisma(spec)
    const count = vi.fn().mockResolvedValue(12)
    const connection = new Connection(
      [
        { id: 'b', rank: 1 },
        { id: 'a', rank: 1 },
        { id: '0', rank: null }
      ],
      spec,
      count
    )

    expect(args.orderBy).toEqual([
      { rank: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' }
    ])
    expect(args.take).toBe(3)
    expect(countWhere).toEqual({})
    expect(args.where).not.toEqual(countWhere)
    expect(connection.nodes.map((node) => node.id)).toEqual(['a', 'b'])
    expect(connection.pageInfo).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: true
    })
    expect(count).not.toHaveBeenCalled()

    return Promise.all([connection.totalCount, connection.totalCount]).then(
      (totals) => {
        expect(totals).toEqual([12, 12])
        expect(count).toHaveBeenCalledTimes(1)
      }
    )
  })

  it('supports last without before and root id ordering', () => {
    expect(normalizeQuery(fixtureQuery, { last: 2 }).pagination).toMatchObject({
      direction: 'backward',
      limit: 2
    })
    expect(
      normalizeQuery(fixtureQuery, { orderBy: [{ id: 'DESC' }] }).sort
    ).toHaveLength(1)
  })

  it.each([
    { first: 0 },
    { first: 101 },
    { first: 2, last: 2 },
    { first: 2, before: 'x' },
    { last: 2, after: 'x' },
    { filter: { secret: { eq: 'x' } } },
    { filter: { missing: { eq: 'x' } } },
    { filter: { rank: { contains: 'x' } } },
    { orderBy: [{ title: 'ASC', rank: 'DESC' }] },
    { orderBy: [{ comments: { body: 'ASC' } }] },
    { orderBy: [{ title: 'ASC' }, { title: 'DESC' }] },
    { orderBy: [{ title: 'ASC' }, { title: 'DESC' }] }
  ])('rejects invalid query %j', (input) => {
    expect(() => normalizeQuery(fixtureQuery, input)).toThrow()
  })

  it('bounds recursive filters and validates configured search fields', () => {
    let filter: unknown = {}

    for (let index = 0; index < 25; index++) {
      filter = { not: filter }
    }
    expect(() => normalizeQuery(fixtureQuery, { filter })).toThrow(
      'maximum depth'
    )
    expect(() =>
      validateQueryDefinition({ ...fixtureQuery, searchable: ['rank'] })
    ).toThrow('must be a string')
  })
})
