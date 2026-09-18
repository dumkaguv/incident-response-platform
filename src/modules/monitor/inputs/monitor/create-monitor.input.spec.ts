import { BadRequestException, ValidationPipe } from '@nestjs/common'
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory
} from '@nestjs/graphql'
import { Test } from '@nestjs/testing'
import { printSchema } from 'graphql'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ArgumentMetadata } from '@nestjs/common'

import { MonitorResolver } from '@/modules/monitor/resolvers'

import { CreateMonitorInput } from './create-monitor.input'

const pipe = new ValidationPipe({ transform: true })

const full = {
  name: 'Homepage',
  url: 'https://example.com',
  method: 'GET',
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatusMin: 200,
  expectedStatusMax: 299,
  isActive: true
}

function validate(value: unknown): Promise<unknown> {
  return pipe.transform(value, {
    type: 'body',
    metatype: CreateMonitorInput
  } as ArgumentMetadata)
}

function inputBlock(sdl: string, name: string): string {
  const start = sdl.indexOf(`input ${name} {`)

  return sdl.slice(start, sdl.indexOf('}', start))
}

describe('CreateMonitorInput', () => {
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

  it('declares every omittable field non-null with the contract default', () => {
    const block = inputBlock(sdl, 'CreateMonitorInput')

    expect(block).toContain('method: MonitorMethod! = GET')
    expect(block).toContain('intervalSeconds: Int! = 60')
    expect(block).toContain('timeoutMs: Int! = 5000')
    expect(block).toContain('expectedStatusMin: Int! = 200')
    expect(block).toContain('expectedStatusMax: Int! = 299')
    expect(block).toContain('isActive: Boolean! = true')
  })

  it('keeps the patch input nullable and free of defaults', () => {
    const block = inputBlock(sdl, 'UpdateMonitorInput')

    expect(block).toContain('intervalSeconds: Int\n')
    expect(block).toContain('name: String\n')
    expect(block).not.toContain('= ')
  })

  it('accepts a complete payload', async () => {
    await expect(validate(full)).resolves.toMatchObject(full)
  })

  it.each([
    'http://localhost:3001',
    'https://localhost:8443/health',
    'http://127.0.0.1:3001',
    'http://10.0.0.5/health',
    'https://example.com/health?deep=1'
  ])('accepts %s, a host a probe can actually reach', async (url) => {
    await expect(validate({ ...full, url })).resolves.toMatchObject({ url })
  })

  it.each([
    'ftp://example.com',
    'example.com',
    'javascript:alert(1)',
    'not a url'
  ])('refuses %s, which no probe could send', async (url) => {
    await expect(validate({ ...full, url })).rejects.toBeInstanceOf(
      BadRequestException
    )
  })

  it.each([
    'method',
    'intervalSeconds',
    'timeoutMs',
    'expectedStatusMin',
    'expectedStatusMax',
    'isActive'
  ])('rejects an explicit null for %s', async (field) => {
    await expect(validate({ ...full, [field]: null })).rejects.toBeInstanceOf(
      BadRequestException
    )
  })
})
