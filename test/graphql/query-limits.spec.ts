import { buildSchema, parse } from 'graphql'
import { describe, expect, it } from 'vitest'
import type { GraphQLError } from 'graphql'
import type { MercuriusContext } from 'mercurius'

import {
  guardDocumentShape,
  guardQueryLimits
} from '@/core/graphql/limits/query-limits.hook'

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

function shape(query: string, operationName?: string): void {
  guardDocumentShape(schema, parse(query), contextFor(operationName))
}

function refusalOf(query: string, operationName?: string): GraphQLError {
  try {
    shape(query, operationName)
  } catch (error) {
    return error as GraphQLError
  }

  throw new Error('the query was allowed through')
}

const deep = `{ root { ${'child { '.repeat(13)}id${' }'.repeat(13)} } }`

function nestedAliases(count: number): string {
  const fields = Array.from(
    { length: count },
    (_, index) => `a${String(index)}: id`
  ).join(' ')

  return `{ monitors(first: 1) { nodes { ${fields} } } }`
}

function repeatedKey(count: number): string {
  const fields = Array.from({ length: count }, () => 'a: id').join(' ')

  return `{ monitors(first: 1) { nodes { ${fields} } } }`
}

function rootAliases(count: number): string {
  const fields = Array.from(
    { length: count },
    (_, index) => `a${String(index)}: monitors(first: 1) { totalCount }`
  ).join(' ')

  return `{ ${fields} }`
}

describe('guardDocumentShape', () => {
  it('lets an ordinary page through', () => {
    expect(() =>
      shape('{ monitors(first: 25) { nodes { id name } } }')
    ).not.toThrow()
  })

  it('refuses a query deeper than the limit', () => {
    expect(() => shape(deep)).toThrow(/Query depth \d+ exceeds the limit of 12/)
  })

  it('refuses as user input, not as a server fault', () => {
    expect(refusalOf(deep).extensions.code).toBe('BAD_USER_INPUT')
  })

  it('refuses more root fields than the limit, however cheap each one looks', () => {
    expect(() => shape(rootAliases(21))).toThrow(
      /Query selects 21 root fields, which exceeds the limit of 20/
    )
  })

  it('lets a request that stays at the root field limit through', () => {
    expect(() => shape(rootAliases(20))).not.toThrow()
  })

  it('counts the root fields of the operation the client named', () => {
    const document = `
      query Narrow { monitors(first: 1) { totalCount } }
      query Wide { ${Array.from(
        { length: 21 },
        (_, index) => `a${String(index)}: monitors(first: 1) { totalCount }`
      ).join(' ')} }
    `

    expect(() => shape(document, 'Narrow')).not.toThrow()
    expect(() => shape(document, 'Wide')).toThrow(/root fields/)
  })

  it('refuses a document with more selections than the limit', () => {
    expect(() => shape(nestedAliases(1200))).toThrow(
      /Query selects \d+ fields, which exceeds the limit of 1000/
    )
  })

  it('lets a document that stays under the selection limit through', () => {
    expect(() => shape(nestedAliases(900))).not.toThrow()
  })

  it('refuses one response key repeated past the limit in a selection set', () => {
    expect(() => shape(repeatedKey(30))).toThrow(
      /Query repeats the field "a" 30 times, which exceeds the limit of 25/
    )
  })

  it('lets a response key repeated under the limit through', () => {
    expect(() => shape(repeatedKey(20))).not.toThrow()
  })

  it('counts the selections of every operation in the document', () => {
    const document = `
      query Small { monitors(first: 1) { totalCount } }
      query Large ${nestedAliases(1200)}
    `

    expect(() => shape(document, 'Small')).toThrow(/exceeds the limit of 1000/)
  })
})

describe('guardQueryLimits', () => {
  it('lets an ordinary page through', () => {
    expect(() =>
      guard('{ monitors(first: 25) { nodes { id name } } }')
    ).not.toThrow()
  })

  it('refuses a query past the complexity cap', () => {
    expect(() =>
      guard('{ monitors(first: 20000) { nodes { id name } } }')
    ).toThrow(/Query complexity \d+ exceeds the limit of 10000/)
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
