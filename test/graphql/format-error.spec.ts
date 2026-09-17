import { BadRequestException, NotFoundException } from '@nestjs/common'
import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'
import type { GraphQLFormattedError } from 'graphql'

import { NotFoundError } from '@/common/utils'
import { createErrorFormatter } from '@/core/graphql/errors/format-graphql-error'

const unexpected: GraphQLFormattedError = {
  message: 'relation "monitor" does not exist',
  path: ['monitor'],
  extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['at somewhere'] }
}

describe('createErrorFormatter', () => {
  it('masks unexpected errors outside debug mode', () => {
    expect(
      createErrorFormatter({ debug: false })(unexpected, new Error('boom'))
    ).toEqual({
      message: 'Internal server error',
      path: ['monitor'],
      extensions: { code: 'INTERNAL_SERVER_ERROR' }
    })
  })

  it('keeps unexpected errors verbatim in debug mode', () => {
    expect(
      createErrorFormatter({ debug: true })(unexpected, new Error('boom'))
    ).toBe(unexpected)
  })

  it('unwraps an AppError carried by the GraphQL error', () => {
    const wrapped = new GraphQLError('wrapped', {
      originalError: new NotFoundError('Nothing here')
    })

    expect(createErrorFormatter({ debug: false })(unexpected, wrapped)).toEqual(
      {
        message: 'Nothing here',
        path: ['monitor'],
        extensions: { code: 'NOT_FOUND' }
      }
    )
  })

  it('reports validation messages as BAD_USER_INPUT', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: ['name must be longer than or equal to 1 characters']
    })

    expect(
      createErrorFormatter({ debug: false })(unexpected, exception)
    ).toEqual({
      message: 'Validation failed',
      path: ['monitor'],
      extensions: {
        code: 'BAD_USER_INPUT',
        errors: ['name must be longer than or equal to 1 characters']
      }
    })
  })

  it('maps other http exceptions by status', () => {
    expect(
      createErrorFormatter({ debug: false })(
        unexpected,
        new NotFoundException('gone')
      )
    ).toEqual({
      message: 'gone',
      path: ['monitor'],
      extensions: { code: 'NOT_FOUND' }
    })
  })

  it('passes an already classified error through', () => {
    const classified: GraphQLFormattedError = {
      message: 'Query depth 13 exceeds the limit of 12',
      extensions: { code: 'BAD_USER_INPUT' }
    }

    expect(
      createErrorFormatter({ debug: false })(classified, new Error('x'))
    ).toBe(classified)
  })
})
