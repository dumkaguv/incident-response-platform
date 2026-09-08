import { describe, expect, it } from 'vitest'

import { deleteOrder } from '~/prisma/seed/reset'

describe('deleteOrder', () => {
  it('puts a child before its parent', () => {
    expect(
      deleteOrder({
        Team: {
          relations: {
            incidents: { cardinality: '1:N', to: { model: 'Incident' } }
          }
        },
        Incident: {
          relations: { team: { cardinality: 'N:1', to: { model: 'Team' } } }
        }
      })
    ).toEqual(['Incident', 'Team'])
  })

  it('orders a chain from the deepest child up', () => {
    expect(
      deleteOrder({
        Organisation: {
          relations: { teams: { cardinality: '1:N', to: { model: 'Team' } } }
        },
        Team: {
          relations: {
            incidents: { cardinality: '1:N', to: { model: 'Incident' } }
          }
        },
        Incident: {}
      })
    ).toEqual(['Incident', 'Team', 'Organisation'])
  })

  it('keeps a model with no relations at all', () => {
    expect(deleteOrder({ Audit: {} })).toEqual(['Audit'])
  })

  it('refuses cyclic foreign keys instead of guessing an order', () => {
    expect(() =>
      deleteOrder({
        A: { relations: { bs: { cardinality: '1:N', to: { model: 'B' } } } },
        B: { relations: { as: { cardinality: '1:N', to: { model: 'A' } } } }
      })
    ).toThrow(/cyclic foreign keys between A -> B -> A/)
  })
})
