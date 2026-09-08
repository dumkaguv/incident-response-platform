import { msg } from '@lingui/core/macro'
import { Test } from '@nestjs/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ArgumentsHost } from '@nestjs/common'

import { ConflictError, NotFoundError } from '@/common/utils'
import { AppErrorFilter } from '@/graphql'
import { type AppLocale, I18nModule } from '@/i18n'
import { resolveLocale } from '@/i18n/resolve-locale'

function hostWithLocale(locale: AppLocale): ArgumentsHost {
  return {
    getArgs: () => [undefined, undefined, { locale }, undefined],
    getType: () => 'graphql'
  } as unknown as ArgumentsHost
}

describe('resolveLocale', () => {
  it.for([
    [undefined, 'en'],
    ['', 'en'],
    ['ru-RU,ru;q=0.9,en;q=0.8', 'ru'],
    ['RO-ro', 'ro'],
    ['fr-FR,fr;q=0.9', 'en'],
    ['fr,ru;q=0.5', 'ru']
  ] as const)('maps %s to %s', ([header, expected]) => {
    expect(resolveLocale(header)).toBe(expected)
  })
})

describe('AppErrorFilter', () => {
  let filter: AppErrorFilter

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [I18nModule],
      providers: [AppErrorFilter]
    }).compile()

    await testingModule.init()

    filter = testingModule.get(AppErrorFilter)
  })

  it('translates a macro message into the request locale', () => {
    const id = 'INC-42'
    const graphqlError = filter.catch(
      new NotFoundError(msg`Incident "${id}" was not found`),
      hostWithLocale('ru')
    )

    expect(graphqlError.message).toBe('Инцидент «INC-42» не найден')
    expect(graphqlError.extensions.code).toBe('NOT_FOUND')
  })

  it('falls back to the source locale for an unsupported one', () => {
    const id = 'INC-7'
    const graphqlError = filter.catch(
      new ConflictError(msg`Incident "${id}" is already resolved`),
      hostWithLocale('en')
    )

    expect(graphqlError.message).toBe('Incident "INC-7" is already resolved')
    expect(graphqlError.extensions.code).toBe('CONFLICT')
  })

  it('passes a plain string message through untouched', () => {
    const graphqlError = filter.catch(
      new NotFoundError('Nothing here'),
      hostWithLocale('ru')
    )

    expect(graphqlError.message).toBe('Nothing here')
  })
})
