import {
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  Kind,
  parse
} from 'graphql'
import { describe, expect, it } from 'vitest'

import { connectionSelection } from '@/graphql/selection'

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

  const [field] = operation?.selectionSet.selections ?? []

  return {
    fieldNodes: [field],
    fragments
  } as unknown as GraphQLResolveInfo
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
})
