import { parse } from 'graphql'
import { describe, expect, it } from 'vitest'

import { queryDepth } from '@/core/graphql'

function depth(query: string, operationName?: string): number {
  return queryDepth(parse(query), operationName)
}

describe('queryDepth', () => {
  it('counts each level of field nesting', () => {
    expect(depth('{ incidents { nodes { id } } }')).toBe(3)
    expect(depth('{ incidents { totalCount } }')).toBe(2)
    expect(depth('{ __typename }')).toBe(0)
  })

  it('takes the deepest branch, not the last one', () => {
    expect(
      depth('{ incidents { totalCount nodes { team { members { email } } } } }')
    ).toBe(5)
  })

  it('follows a fragment spread as if it were inlined', () => {
    expect(
      depth(`
        { incidents { nodes { ...Row } } }
        fragment Row on Incident { team { members { email } } }
      `)
    ).toBe(5)
  })

  it('does not charge a level for an inline fragment', () => {
    expect(
      depth('{ incidents { nodes { ... on Incident { team { name } } } } }')
    ).toBe(4)
  })

  it('ignores introspection fields', () => {
    expect(depth('{ incidents { nodes { id __typename } } }')).toBe(3)
  })

  it('measures only the named operation when one is given', () => {
    const document = `
      query Shallow { incidents { totalCount } }
      query Deep { incidents { nodes { team { members { email } } } } }
    `

    expect(depth(document, 'Shallow')).toBe(2)
    expect(depth(document, 'Deep')).toBe(5)
    expect(depth(document)).toBe(5)
  })

  it('survives a self-referencing fragment instead of hanging', () => {
    expect(
      depth(`
        { incidents { nodes { ...Loop } } }
        fragment Loop on Incident { team { incidents { ...Loop } } }
      `)
    ).toBe(4)
  })
})

describe('queryDepth on repeated fragment spreads', () => {
  it('expands each fragment once, so doubling spreads stay linear', () => {
    const levels = 24
    const fragments = ['fragment F0 on Incident { id }']

    for (let level = 1; level <= levels; level += 1) {
      fragments.push(
        `fragment F${level} on Incident { ...F${level - 1} ...F${level - 1} }`
      )
    }

    const started = performance.now()

    expect(
      depth(
        `{ incidents { nodes { ...F${levels} } } }\n${fragments.join('\n')}`
      )
    ).toBe(3)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
