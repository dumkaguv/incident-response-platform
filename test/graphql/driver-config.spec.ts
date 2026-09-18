import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { describe, expect, it } from 'vitest'

import { driverConfig } from '@/core/graphql/graphql.module'
import { MAX_QUERY_TOKENS } from '@/core/graphql/limits/query-limits.constants'
import {
  guardDocumentShape,
  guardQueryLimits
} from '@/core/graphql/limits/query-limits.hook'

describe('driverConfig', () => {
  it('writes the schema file only in debug mode', () => {
    expect(
      driverConfig({ explorer: true, debug: true }).autoSchemaFile
    ).toMatch(/schema\.gql$/)
    expect(driverConfig({ explorer: false, debug: false }).autoSchemaFile).toBe(
      true
    )
  })

  it('turns the explorer and introspection on and off together', () => {
    const on = driverConfig({ explorer: true, debug: false })
    const off = driverConfig({ explorer: false, debug: true })

    expect([on.graphiql, on.validationRules]).toEqual([true, []])
    expect([off.graphiql, off.validationRules]).toEqual([
      false,
      [NoSchemaIntrospectionCustomRule]
    ])
  })

  it('never compiles a query, whatever the mode', () => {
    expect(driverConfig({ explorer: true, debug: true }).jit).toBe(0)
    expect(driverConfig({ explorer: false, debug: false }).jit).toBe(0)
  })

  it('measures complexity before the query executes', () => {
    expect(
      driverConfig({ explorer: false, debug: false }).hooks?.preExecution
    ).toBe(guardQueryLimits)
  })

  it('measures the shape of the document before it is validated', () => {
    const { hooks } = driverConfig({ explorer: false, debug: false })

    expect(hooks?.preValidation).toBeTypeOf('function')
    expect(hooks?.preValidation).toBe(guardDocumentShape)
  })

  it('stops the parser before an oversized document is built', () => {
    const { graphql } = driverConfig({ explorer: false, debug: false })

    expect(graphql?.parseOptions?.maxTokens).toBeTypeOf('number')
    expect(graphql?.parseOptions?.maxTokens).toBe(MAX_QUERY_TOKENS)
  })
})
