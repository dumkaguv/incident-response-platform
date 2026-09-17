import { buildSchema, parse } from 'graphql'
import { getComplexity } from 'graphql-query-complexity'
import { describe, expect, it } from 'vitest'

import { shapeComplexity } from '@/core/graphql/limits/complexity.estimator'

const schema = buildSchema(`
  type Query {
    items(first: Int, last: Int): ItemConnection!
  }

  type ItemConnection {
    edges: [ItemEdge!]!
    nodes: [Item!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ItemEdge {
    node: Item!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type Item {
    id: ID!
    tags: [String!]!
    children(first: Int): ItemConnection!
  }
`)

function cost(query: string): number {
  return getComplexity({
    schema,
    query: parse(query),
    estimators: [shapeComplexity],
    variables: {}
  })
}

describe('shapeComplexity', () => {
  it('prices a page as its size times the selection', () => {
    expect(cost('{ items(first: 10) { nodes { id } } }')).toBe(11)
  })

  it('charges for a scalar list instead of letting it ride free', () => {
    expect(cost('{ items(first: 10) { nodes { tags } } }')).toBe(261)
  })

  it('charges for totalCount, which is its own COUNT query', () => {
    expect(cost('{ items(first: 10) { totalCount } }')).toBe(11)
  })

  it('does not apply the unbounded fanout to edges', () => {
    expect(cost('{ items(first: 10) { edges { node { id } } } }')).toBe(21)
  })

  it('falls back to the default page when first is not a usable size', () => {
    expect(cost('{ items(first: 0) { nodes { id } } }')).toBe(26)
    expect(cost('{ items(first: -100) { nodes { id } } }')).toBe(26)
    expect(cost('{ items { nodes { id } } }')).toBe(26)
  })

  it('multiplies nested connections', () => {
    expect(
      cost(
        '{ items(first: 10) { nodes { id children(first: 20) { nodes { id } } } } }'
      )
    ).toBe(221)
  })
})
