import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory
} from '@nestjs/graphql'
import { Test } from '@nestjs/testing'
import { printSchema } from 'graphql'
import { beforeAll, describe, expect, it } from 'vitest'

import { MonitorResolver } from './monitor.resolver'

function inputBlock(sdl: string, name: string): string {
  const start = sdl.indexOf(`input ${name} {`)

  return sdl.slice(start, sdl.indexOf('}', start))
}

function fieldsOf(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[a-zA-Z]+:/.test(line))
    .map((line) => line.split(':')[0])
    .sort()
}

describe('monitorQuery', () => {
  let sdl: string

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule]
    }).compile()

    try {
      sdl = printSchema(
        await module.get(GraphQLSchemaFactory).create([MonitorResolver])
      )
    } finally {
      await module.close()
    }
  })

  it('offers ordering only on the columns an index serves', () => {
    expect(fieldsOf(inputBlock(sdl, 'MonitorOrderBy'))).toEqual([
      'createdAt',
      'id',
      'name'
    ])
  })

  it('keeps every column filterable', () => {
    expect(fieldsOf(inputBlock(sdl, 'MonitorFilter'))).toEqual([
      'and',
      'checks',
      'consecutiveFailures',
      'createdAt',
      'expectedStatusMax',
      'expectedStatusMin',
      'id',
      'intervalSeconds',
      'isActive',
      'lastCheckedAt',
      'lastResponseTimeMs',
      'lastStatus',
      'lastStatusCode',
      'method',
      'name',
      'nextCheckAt',
      'not',
      'or',
      'timeoutMs',
      'updatedAt',
      'url'
    ])
  })
})
