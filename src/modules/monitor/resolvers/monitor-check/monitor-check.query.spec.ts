import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory
} from '@nestjs/graphql'
import { Test } from '@nestjs/testing'
import { printSchema } from 'graphql'
import { beforeAll, describe, expect, it } from 'vitest'

import { MonitorCheckResolver } from './monitor-check.resolver'

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

describe('monitorCheckQuery', () => {
  let sdl: string

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule]
    }).compile()

    try {
      sdl = printSchema(
        await module.get(GraphQLSchemaFactory).create([MonitorCheckResolver])
      )
    } finally {
      await module.close()
    }
  })

  it('offers ordering only on the columns the (checked_at, id) index serves', () => {
    expect(fieldsOf(inputBlock(sdl, 'MonitorCheckOrderBy'))).toEqual([
      'checkedAt',
      'id'
    ])
  })

  it('keeps every column filterable', () => {
    expect(fieldsOf(inputBlock(sdl, 'MonitorCheckFilter'))).toEqual([
      'and',
      'checkedAt',
      'errorMessage',
      'errorType',
      'id',
      'monitor',
      'monitorId',
      'not',
      'or',
      'responseTimeMs',
      'status',
      'statusCode'
    ])
  })
})
