import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { describe, expect, it } from 'vitest'

import { driverConfig } from '@/core/graphql/graphql.module'
import { guardQueryLimits } from '@/core/graphql/limits/query-limits.hook'

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

  it('compiles a query once it has been seen before', () => {
    expect(driverConfig({ explorer: false, debug: false }).jit).toBe(1)
  })

  it('measures depth and complexity before the query executes', () => {
    expect(
      driverConfig({ explorer: false, debug: false }).hooks?.preExecution
    ).toBe(guardQueryLimits)
  })
})
