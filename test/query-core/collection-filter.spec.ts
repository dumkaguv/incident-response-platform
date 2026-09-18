import { describe, expect, it } from 'vitest'

import { parseFilter } from '@/core/pagination/utils/query-filter'

import { fixtureQuery } from './fixtures/query-definition'

function filterOf(input: unknown): unknown {
  return parseFilter(fixtureQuery.fields, input)
}

const people = { field: 'people', kind: 'relation' }

function throughOwner(child: unknown): unknown {
  return {
    kind: 'relation',
    field: 'assignee',
    quantifier: 'is',
    child: {
      kind: 'relation',
      field: 'organization',
      quantifier: 'is',
      child
    }
  }
}

describe('collection quantifiers', () => {
  it('leaves some and none as the client wrote them', () => {
    expect(filterOf({ comments: { some: { flagged: { eq: true } } } })).toEqual(
      {
        kind: 'relation',
        field: 'comments',
        quantifier: 'some',
        child: {
          kind: 'condition',
          field: 'flagged',
          operator: 'eq',
          value: true
        }
      }
    )
    expect(filterOf({ comments: { none: { flagged: { eq: true } } } })).toEqual(
      {
        kind: 'relation',
        field: 'comments',
        quantifier: 'none',
        child: {
          kind: 'condition',
          field: 'flagged',
          operator: 'eq',
          value: true
        }
      }
    )
  })

  it('reads every as no row that fails, so an empty collection still holds', () => {
    expect(
      filterOf({ comments: { every: { flagged: { eq: true } } } })
    ).toEqual({
      kind: 'relation',
      field: 'comments',
      quantifier: 'none',
      child: {
        kind: 'not',
        child: {
          kind: 'condition',
          field: 'flagged',
          operator: 'eq',
          value: true
        }
      }
    })
  })

  it('counts a null column as a row that fails every, not as no row at all', () => {
    expect(
      filterOf({
        owner: { organization: { people: { every: { name: { eq: 'Ada' } } } } }
      })
    ).toEqual(
      throughOwner({
        ...people,
        quantifier: 'none',
        child: {
          kind: 'or',
          children: [
            {
              kind: 'not',
              child: {
                kind: 'condition',
                field: 'name',
                operator: 'eq',
                value: 'Ada',
                nullable: true
              }
            },
            { kind: 'condition', field: 'name', operator: 'eq', value: null }
          ]
        }
      })
    )
  })

  it('keeps a non-null column in every to a plain negation', () => {
    expect(
      filterOf({
        owner: {
          organization: { people: { every: { email: { eq: 'a@b.test' } } } }
        }
      })
    ).toEqual(
      throughOwner({
        ...people,
        quantifier: 'none',
        child: {
          kind: 'not',
          child: {
            kind: 'condition',
            field: 'email',
            operator: 'eq',
            value: 'a@b.test'
          }
        }
      })
    )
  })

  it('turns every of a negation back into the condition itself', () => {
    expect(
      filterOf({ comments: { every: { not: { flagged: { eq: true } } } } })
    ).toEqual({
      kind: 'relation',
      field: 'comments',
      quantifier: 'none',
      child: {
        kind: 'condition',
        field: 'flagged',
        operator: 'eq',
        value: true
      }
    })
  })

  it('spreads every over a group by flipping it', () => {
    expect(
      filterOf({
        comments: { every: { flagged: { eq: true }, body: { eq: 'needle' } } }
      })
    ).toEqual({
      kind: 'relation',
      field: 'comments',
      quantifier: 'none',
      child: {
        kind: 'or',
        children: [
          {
            kind: 'not',
            child: {
              kind: 'condition',
              field: 'flagged',
              operator: 'eq',
              value: true
            }
          },
          {
            kind: 'not',
            child: {
              kind: 'condition',
              field: 'body',
              operator: 'eq',
              value: 'needle'
            }
          }
        ]
      }
    })
  })
})
