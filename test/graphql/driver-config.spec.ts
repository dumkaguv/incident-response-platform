import { describe, expect, it } from 'vitest'

import { driverConfig } from '@/core/graphql/graphql.module'

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

    expect([on.graphiql, on.introspection]).toEqual([true, true])
    expect([off.graphiql, off.introspection]).toEqual([false, false])
  })

  it('includes stack traces only in debug mode', () => {
    expect(
      driverConfig({ explorer: false, debug: true })
        .includeStacktraceInErrorResponses
    ).toBe(true)
    expect(
      driverConfig({ explorer: false, debug: false })
        .includeStacktraceInErrorResponses
    ).toBe(false)
  })
})
