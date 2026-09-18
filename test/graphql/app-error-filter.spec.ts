import { msg } from '@lingui/core/macro'
import { Test } from '@nestjs/testing'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ArgumentsHost } from '@nestjs/common'

import { AppError, NotFoundError } from '@/common/utils'
import { AppErrorFilter } from '@/core/graphql'
import { I18nModule } from '@/core/i18n'

class UnmappedError extends AppError {
  public readonly code = 'UNMAPPED'

  constructor() {
    super('No status maps to this')
  }
}

function httpHost(acceptLanguage: string) {
  const reply = { status: vi.fn(), send: vi.fn() }

  reply.status.mockReturnValue(reply)

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'accept-language': acceptLanguage } }),
      getResponse: () => reply
    })
  } as unknown as ArgumentsHost

  return { host, reply }
}

describe('AppErrorFilter on an HTTP host', () => {
  let filter: AppErrorFilter

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [I18nModule],
      providers: [AppErrorFilter]
    }).compile()

    await testingModule.init()

    filter = testingModule.get(AppErrorFilter)
  })

  it('answers with the status of the error code and a translated body', () => {
    const { host, reply } = httpHost('ru')
    const id = 'INC-42'

    const returned = filter.catch(
      new NotFoundError(msg`Monitor "${id}" was not found`),
      host
    )

    expect(returned).toBeUndefined()
    expect(reply.status).toHaveBeenCalledWith(404)
    expect(reply.send).toHaveBeenCalledWith({
      message: 'Монитор «INC-42» не найден',
      code: 'NOT_FOUND'
    })
  })

  it('falls back to 500 for a code without an HTTP status', () => {
    const { host, reply } = httpHost('en')

    filter.catch(new UnmappedError(), host)

    expect(reply.status).toHaveBeenCalledWith(500)
    expect(reply.send).toHaveBeenCalledWith({
      message: 'No status maps to this',
      code: 'UNMAPPED'
    })
  })
})
