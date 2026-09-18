import {
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  Kind,
  parse
} from 'graphql'
import { describe, expect, it } from 'vitest'

import { connectionSelection } from '@/core/graphql/selection'

function infoFor(query: string): GraphQLResolveInfo {
  const document = parse(query)
  const operation = document.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION
  )
  const fragments: Record<string, FragmentDefinitionNode> = {}

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition
    }
  }

  const fieldNodes = (operation?.selectionSet.selections ?? []).filter(
    (selection) => selection.kind === Kind.FIELD
  )

  return { fieldNodes, fragments } as unknown as GraphQLResolveInfo
}

describe('connectionSelection', () => {
  it('collects fields requested under nodes', () => {
    const fields = connectionSelection(
      infoFor('{ incidents { nodes { id title } } }')
    )

    expect(fields.sort()).toEqual(['id', 'title'])
  })

  it('collects fields requested under edges.node', () => {
    const fields = connectionSelection(
      infoFor('{ incidents { edges { node { id severity } cursor } } }')
    )

    expect(fields.sort()).toEqual(['id', 'severity'])
  })

  it('follows fragment spreads and inline fragments', () => {
    const fields = connectionSelection(
      infoFor(`
        fragment Row on Incident { id status }
        { incidents { nodes { ...Row ... on Incident { title } } } }
      `)
    )

    expect(fields.sort()).toEqual(['id', 'status', 'title'])
  })

  it('merges nodes and edges and keeps relation fields', () => {
    const fields = connectionSelection(
      infoFor(`{
        incidents {
          nodes { id team { name } }
          edges { node { title } }
          pageInfo { endCursor }
        }
      }`)
    )

    expect(fields.sort()).toEqual(['id', 'team', 'title'])
  })

  it('returns nothing when only pagination metadata is requested', () => {
    const fields = connectionSelection(
      infoFor('{ incidents { totalCount pageInfo { endCursor } } }')
    )

    expect(fields).toEqual([])
  })

  it('merges a selection repeated under the same response key', () => {
    const fields = connectionSelection(
      infoFor('{ incidents { nodes { id } nodes { title } } }')
    )

    expect(fields.sort()).toEqual(['id', 'title'])
  })

  it('merges edges repeated under the same response key', () => {
    const fields = connectionSelection(
      infoFor(
        '{ incidents { edges { node { id } } edges { node { severity } } } }'
      )
    )

    expect(fields.sort()).toEqual(['id', 'severity'])
  })

  it('merges every field node the root field was requested through', () => {
    const fields = connectionSelection(
      infoFor(
        '{ incidents { nodes { id } } incidents { edges { node { title } } } }'
      )
    )

    expect(fields.sort()).toEqual(['id', 'title'])
  })

  it('merges a repeated selection reached through fragments', () => {
    const fields = connectionSelection(
      infoFor(`
        fragment Ids on IncidentConnection { nodes { id } }
        { incidents { ...Ids nodes { status } } }
      `)
    )

    expect(fields.sort()).toEqual(['id', 'status'])
  })
})

describe('connectionSelection on repeated fragment spreads', () => {
  it('expands each fragment once, so doubling spreads stay linear', () => {
    const levels = 24
    const fragments = ['fragment F0 on Incident { id }']

    for (let level = 1; level <= levels; level += 1) {
      fragments.push(
        `fragment F${level} on Incident { ...F${level - 1} ...F${level - 1} }`
      )
    }

    const started = performance.now()
    const fields = connectionSelection(
      infoFor(
        `{ incidents { nodes { ...F${levels} } edges { node { ...F${levels} } } } }\n${fragments.join('\n')}`
      )
    )

    expect(fields).toEqual(['id'])
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
