import { buildSchema, parse } from 'graphql'
import { describe, expect, it } from 'vitest'
import type { GraphQLError } from 'graphql'
import type { MercuriusContext } from 'mercurius'

import { guardQueryLimits } from '@/core/graphql/limits/query-limits.hook'

const schema = buildSchema(`
  type Query { monitors(first: Int): MonitorConnection!, root: Node! }
  type MonitorConnection { nodes: [Monitor!]!, pageInfo: PageInfo!, totalCount: Int! }
  type PageInfo { hasNextPage: Boolean! }
  type Monitor { id: ID!, name: String! }
  type Node { child: Node!, id: ID! }
`)

function contextFor(operationName?: string): MercuriusContext {
  return {
    reply: { request: { body: { operationName }, query: {} } }
  } as unknown as MercuriusContext
}

function guard(query: string, operationName?: string): void {
  guardQueryLimits(schema, parse(query), contextFor(operationName), {})
}

function refusalOf(query: string, operationName?: string): GraphQLError {
  try {
    guard(query, operationName)
  } catch (error) {
    return error as GraphQLError
  }

  throw new Error('the query was allowed through')
}

const deep = `{ root { ${'child { '.repeat(13)}id${' }'.repeat(13)} } }`

describe('guardQueryLimits', () => {
  it('lets an ordinary page through', () => {
    expect(() =>
      guard('{ monitors(first: 25) { nodes { id name } } }')
    ).not.toThrow()
  })

  it('refuses a query deeper than the limit', () => {
    expect(() => guard(deep)).toThrow(/Query depth \d+ exceeds the limit of 12/)
  })

  it('refuses a query past the complexity cap', () => {
    expect(() =>
      guard('{ monitors(first: 20000) { nodes { id name } } }')
    ).toThrow(/Query complexity \d+ exceeds the limit of 10000/)
  })

  it('refuses as user input, not as a server fault', () => {
    expect(refusalOf(deep).extensions.code).toBe('BAD_USER_INPUT')
  })

  it('refuses more root fields than the limit, however cheap each one looks', () => {
    const aliases = Array.from(
      { length: 21 },
      (_, index) => `a${String(index)}: monitors(first: 1) { totalCount }`
    ).join(' ')

    expect(() => guard(`{ ${aliases} }`)).toThrow(
      /Query selects 21 root fields, which exceeds the limit of 20/
    )
  })

  it('lets a request that stays at the root field limit through', () => {
    const aliases = Array.from(
      { length: 20 },
      (_, index) => `a${String(index)}: monitors(first: 1) { totalCount }`
    ).join(' ')

    expect(() => guard(`{ ${aliases} }`)).not.toThrow()
  })

  it('counts the root fields of the operation the client named', () => {
    const document = `
      query Narrow { monitors(first: 1) { totalCount } }
      query Wide { ${Array.from(
        { length: 21 },
        (_, index) => `a${String(index)}: monitors(first: 1) { totalCount }`
      ).join(' ')} }
    `

    expect(() => guard(document, 'Narrow')).not.toThrow()
    expect(() => guard(document, 'Wide')).toThrow(/root fields/)
  })

  it('measures the operation the client named', () => {
    const document = `
      query Cheap { monitors(first: 5) { nodes { id } } }
      query Expensive { monitors(first: 20000) { nodes { id name } } }
    `

    expect(() => guard(document, 'Cheap')).not.toThrow()
    expect(() => guard(document, 'Expensive')).toThrow(/Query complexity/)
  })
})
