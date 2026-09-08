import { describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'

import { getLoader, loadRelation, loadRelations } from '@/core/graphql'
import type { GqlContext } from '@/core/graphql'

type Row = { id: string; teamId: string | null; title: string }

const rows: Row[] = [
  { id: 'i1', teamId: 't1', title: 'first' },
  { id: 'i2', teamId: 't2', title: 'second' },
  { id: 'i3', teamId: 't1', title: 'third' },
  { id: 'i4', teamId: null, title: 'orphan' }
]

function context(): GqlContext {
  return { loaders: new Map() } as GqlContext
}

function info(fieldName: string, parent = 'Incident'): GraphQLResolveInfo {
  return {
    fieldName,
    parentType: { name: parent }
  } as unknown as GraphQLResolveInfo
}

describe('loadRelation', () => {
  it('collapses many calls into one fetch and answers in key order', async () => {
    const fetch = vi.fn((ids: readonly string[]) =>
      Promise.resolve(rows.filter((row) => ids.includes(row.id)).reverse())
    )
    const ctx = context()

    const loaded = await Promise.all([
      loadRelation(ctx, info('team'), 'i3', fetch),
      loadRelation(ctx, info('team'), 'i1', fetch),
      loadRelation(ctx, info('team'), 'i2', fetch)
    ])

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]?.[0]).toEqual(['i3', 'i1', 'i2'])
    expect(loaded.map((row) => row?.title)).toEqual([
      'third',
      'first',
      'second'
    ])
  })

  it('answers null for a key the fetch did not return', async () => {
    const fetch = vi.fn(() => Promise.resolve([]))

    expect(await loadRelation(context(), info('team'), 'missing', fetch)).toBe(
      null
    )
  })

  it('never calls fetch for a nullish key', async () => {
    const fetch = vi.fn(() => Promise.resolve(rows))

    expect(await loadRelation(context(), info('team'), null, fetch)).toBe(null)
    expect(await loadRelation(context(), info('team'), undefined, fetch)).toBe(
      null
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('matches rows back through a custom identify', async () => {
    const loaded = await loadRelation(context(), info('team'), 't2', {
      fetch: (ids: readonly string[]) =>
        Promise.resolve(rows.filter((row) => ids.includes(row.teamId ?? ''))),
      identify: (row: Row) => row.teamId
    })

    expect(loaded?.title).toBe('second')
  })

  it('shares one loader per field and keeps fields apart', async () => {
    const ctx = context()
    const fetch = vi.fn((ids: readonly string[]) =>
      Promise.resolve(rows.filter((row) => ids.includes(row.id)))
    )

    await Promise.all([
      loadRelation(ctx, info('team'), 'i1', fetch),
      loadRelation(ctx, info('team'), 'i2', fetch),
      loadRelation(ctx, info('owner'), 'i3', fetch)
    ])

    expect(fetch).toHaveBeenCalledTimes(2)
    expect([...ctx.loaders.keys()]).toEqual(['Incident.team', 'Incident.owner'])
  })
})

describe('loadRelations', () => {
  it('groups rows per key and answers [] for a key with none', async () => {
    const fetch = vi.fn((ids: readonly string[]) =>
      Promise.resolve(rows.filter((row) => ids.includes(row.teamId ?? '')))
    )
    const ctx = context()
    const source = { fetch, identify: (row: Row) => row.teamId }

    const [first, second, empty] = await Promise.all([
      loadRelations(ctx, info('incidents', 'Team'), 't1', source),
      loadRelations(ctx, info('incidents', 'Team'), 't2', source),
      loadRelations(ctx, info('incidents', 'Team'), 't9', source)
    ])

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(first.map((row) => row.id)).toEqual(['i1', 'i3'])
    expect(second.map((row) => row.id)).toEqual(['i2'])
    expect(empty).toEqual([])
  })

  it('drops a row whose grouping key is null', async () => {
    const loaded = await loadRelations(
      context(),
      info('incidents', 'Team'),
      't1',
      {
        fetch: () => Promise.resolve(rows),
        identify: (row: Row) => row.teamId
      }
    )

    expect(loaded.map((row) => row.id)).toEqual(['i1', 'i3'])
  })
})

describe('getLoader', () => {
  it('returns the same instance for a repeated cache key', () => {
    const ctx = context()

    function batch(): Promise<never[]> {
      return Promise.resolve([])
    }

    expect(getLoader(ctx, 'team.byId', batch)).toBe(
      getLoader(ctx, 'team.byId', batch)
    )
    expect(getLoader(ctx, 'team.byId', batch)).not.toBe(
      getLoader(ctx, 'other', batch)
    )
  })
})
