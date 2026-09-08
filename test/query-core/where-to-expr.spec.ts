import postgres from '@prisma/orm-postgres/runtime'
import { describe, expect, it } from 'vitest'

import contractJson from '@/core/prisma/contract.json' with { type: 'json' }
import {
  type FieldBag,
  orderPlanToSteps,
  orderSelector,
  whereToExpr
} from '@/core/prisma/utils/where-to-expr'
import type { Contract } from '@/core/prisma/contract'

const db = postgres<Contract>({
  contractJson,
  url: 'postgresql://unused:unused@127.0.0.1:1/unused'
})

function withFields<T>(build: (fields: FieldBag) => T): T {
  let captured: T | undefined
  let called = false

  db.orm.public.Incident.where((fields) => {
    captured = build(fields)
    called = true

    return whereToExpr(fields, {})
  })

  if (!called) {
    throw new Error('where callback did not run')
  }

  return captured as T
}

function compile(where: Record<string, unknown>): unknown {
  return withFields((fields) => whereToExpr(fields, where))
}

describe('whereToExpr', () => {
  it('compiles an empty filter to a TRUE expression', () => {
    expect(compile({})).toMatchObject({ kind: 'and', exprs: [] })
  })

  it('compiles an empty OR to a FALSE expression', () => {
    expect(compile({ OR: [] })).toMatchObject({ kind: 'or', exprs: [] })
  })

  it('compiles shorthand equality', () => {
    expect(compile({ status: 'OPEN' })).toMatchObject({ kind: 'binary' })
  })

  it.each([
    ['equals', { status: { equals: 'OPEN' } }],
    ['not', { status: { not: 'OPEN' } }],
    ['in', { severity: { in: ['LOW', 'HIGH'] } }],
    ['notIn', { severity: { notIn: ['LOW'] } }],
    ['lt', { createdAt: { lt: '2026-01-01T00:00:00.000Z' } }],
    ['gte', { createdAt: { gte: '2026-01-01T00:00:00.000Z' } }]
  ])('compiles the %s operator', (_name, where) => {
    expect(() => compile(where)).not.toThrow()
  })

  it('maps null equality to IS NULL', () => {
    expect(compile({ resolvedAt: { equals: null } })).toMatchObject({
      kind: 'null-check'
    })
  })

  it('maps a null-valued field to IS NULL', () => {
    expect(compile({ resolvedAt: null })).toMatchObject({ kind: 'null-check' })
  })

  it('nests AND / OR / NOT', () => {
    const expr = compile({
      AND: [
        { status: 'OPEN' },
        { OR: [{ severity: 'HIGH' }, { severity: 'CRITICAL' }] },
        { NOT: { title: { equals: 'x' } } }
      ]
    })

    expect(expr).toMatchObject({
      kind: 'and',
      exprs: [{ kind: 'binary' }, { kind: 'or' }, { kind: 'not' }]
    })
  })

  it('escapes LIKE wildcards so a literal % is not a wildcard', () => {
    expect(() => compile({ title: { contains: '50%_off' } })).not.toThrow()
  })

  it('uses ILIKE for insensitive mode and LIKE otherwise', () => {
    const insensitive = compile({
      title: { contains: 'needle', mode: 'insensitive' }
    })
    const sensitive = compile({ title: { contains: 'needle' } })

    expect(insensitive).not.toStrictEqual(sensitive)
  })

  it('rejects an unknown operator', () => {
    expect(() => compile({ title: { spaceship: 'x' } })).toThrow(
      /Unsupported filter operator "spaceship"/
    )
  })

  it('rejects an unknown field', () => {
    expect(() => compile({ nope: 'x' })).toThrow(/Unknown filter field "nope"/)
  })
})

describe('orderPlanToSteps', () => {
  it('reads plain directions', () => {
    expect(orderPlanToSteps([{ createdAt: 'desc' }, { id: 'asc' }])).toEqual([
      { field: 'createdAt', direction: 'desc' },
      { field: 'id', direction: 'asc' }
    ])
  })

  it.each([
    ['asc', 'last'],
    ['desc', 'first']
  ])(
    'accepts %s ordering when NULLS %s is asked for, matching PostgreSQL',
    (sort, nulls) => {
      expect(orderPlanToSteps([{ resolvedAt: { sort, nulls } }])).toEqual([
        { field: 'resolvedAt', direction: sort }
      ])
    }
  )

  it.each([
    ['asc', 'first'],
    ['desc', 'last']
  ])(
    'rejects %s ordering with NULLS %s, which the builder cannot express',
    (sort, nulls) => {
      expect(() => orderPlanToSteps([{ resolvedAt: { sort, nulls } }])).toThrow(
        /cannot place NULLs/
      )
    }
  )

  it('rejects ordering through a relation', () => {
    expect(() => orderPlanToSteps([{ assignee: { name: 'asc' } }])).toThrow(
      /Ordering through relation "assignee"/
    )
  })

  it('rejects an entry with more than one field', () => {
    expect(() => orderPlanToSteps([{ a: 'asc', b: 'desc' }])).toThrow(
      /exactly one field/
    )
  })
})

describe('orderSelector', () => {
  it('builds ascending and descending items', () => {
    const asc = withFields((fields) =>
      orderSelector(fields, { field: 'createdAt', direction: 'asc' })
    )
    const desc = withFields((fields) =>
      orderSelector(fields, { field: 'createdAt', direction: 'desc' })
    )

    expect(asc).not.toStrictEqual(desc)
  })

  it('rejects an unknown field', () => {
    expect(() =>
      withFields((fields) =>
        orderSelector(fields, { field: 'nope', direction: 'asc' })
      )
    ).toThrow(/Unknown orderBy field "nope"/)
  })
})
