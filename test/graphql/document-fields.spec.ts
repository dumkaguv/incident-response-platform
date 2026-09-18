import { Kind, parse } from 'graphql'
import { describe, expect, it } from 'vitest'
import type { OperationDefinitionNode } from 'graphql'

import {
  fragmentsOf,
  rootFieldCount,
  selectsField
} from '@/core/graphql/limits/document-fields'

function operationOf(query: string): {
  operation: OperationDefinitionNode
  fragments: ReturnType<typeof fragmentsOf>
} {
  const document = parse(query)
  const operation = document.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION
  ) as OperationDefinitionNode

  return { operation, fragments: fragmentsOf(document) }
}

function roots(query: string): number {
  const { operation, fragments } = operationOf(query)

  return rootFieldCount(operation, fragments)
}

function selects(query: string, name: string): boolean {
  const { operation, fragments } = operationOf(query)
  const [field] = operation.selectionSet.selections

  if (field.kind !== Kind.FIELD) {
    throw new Error('the first selection is not a field')
  }

  return selectsField(field.selectionSet, name, fragments)
}

describe('selectsField', () => {
  it('finds a field selected directly', () => {
    expect(selects('{ items { totalCount } }', 'totalCount')).toBe(true)
    expect(selects('{ items { nodes { id } } }', 'totalCount')).toBe(false)
  })

  it('finds a field a fragment spread brought in', () => {
    expect(
      selects(
        '{ items { ...Counted } } fragment Counted on C { totalCount }',
        'totalCount'
      )
    ).toBe(true)
  })

  it('finds a field an inline fragment brought in', () => {
    expect(selects('{ items { ... on C { totalCount } } }', 'totalCount')).toBe(
      true
    )
  })

  it('answers a fragment that spreads itself instead of looping', () => {
    expect(
      selects(
        '{ items { ...Loop } } fragment Loop on C { nodes { id } ...Loop }',
        'totalCount'
      )
    ).toBe(false)
  })
})

describe('rootFieldCount', () => {
  it('counts every root field, aliases included', () => {
    expect(
      roots('{ a: monitors { totalCount } b: monitors { totalCount } }')
    ).toBe(2)
  })

  it('counts the fields a fragment spread brings to the root', () => {
    expect(
      roots(
        '{ ...Two } fragment Two on Query { monitors { id } monitor { id } }'
      )
    ).toBe(2)
  })

  it('counts the same fragment once per spread, not once per document', () => {
    expect(
      roots('{ ...One ...One } fragment One on Query { monitors { id } }')
    ).toBe(2)
  })

  it('leaves introspection meta fields out of the count', () => {
    expect(roots('{ __typename monitors { id } }')).toBe(1)
  })

  it('answers a fragment that spreads itself instead of looping', () => {
    expect(
      roots('{ ...Loop } fragment Loop on Query { monitors { id } ...Loop }')
    ).toBe(1)
  })
})
