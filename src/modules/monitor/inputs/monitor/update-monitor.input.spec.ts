import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import type { ArgumentMetadata } from '@nestjs/common'

import { UpdateMonitorInput } from './update-monitor.input'

const pipe = new ValidationPipe({ transform: true })

function validate(value: unknown): Promise<unknown> {
  return pipe.transform(value, {
    type: 'body',
    metatype: UpdateMonitorInput
  } as ArgumentMetadata)
}

describe('UpdateMonitorInput', () => {
  it('accepts an empty patch and a partial one', async () => {
    await expect(validate({})).resolves.toEqual({})
    await expect(validate({ name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed'
    })
  })

  it.each([
    'name',
    'url',
    'method',
    'intervalSeconds',
    'timeoutMs',
    'expectedStatusCode',
    'isActive'
  ])('rejects an explicit null for %s', async (field) => {
    await expect(validate({ [field]: null })).rejects.toBeInstanceOf(
      BadRequestException
    )
  })

  it('still validates a value that is present', async () => {
    await expect(validate({ intervalSeconds: 1 })).rejects.toBeInstanceOf(
      BadRequestException
    )
  })
})
