import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import type { ArgumentMetadata } from '@nestjs/common'

import { CreateMonitorInput } from './create-monitor.input'

const pipe = new ValidationPipe({ transform: true })

const valid = { name: 'Homepage', url: 'https://example.com' }

function validate(value: unknown): Promise<unknown> {
  return pipe.transform(value, {
    type: 'body',
    metatype: CreateMonitorInput
  } as ArgumentMetadata)
}

describe('CreateMonitorInput', () => {
  it('accepts omitted optional fields', async () => {
    await expect(validate(valid)).resolves.toMatchObject(valid)
  })

  it.each([
    'method',
    'intervalSeconds',
    'timeoutMs',
    'expectedStatusCode',
    'isActive'
  ])('rejects an explicit null for %s', async (field) => {
    await expect(validate({ ...valid, [field]: null })).rejects.toBeInstanceOf(
      BadRequestException
    )
  })
})
