import { BadRequestException, NotFoundException } from '@nestjs/common'
import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'

import { NotFoundError, TooManyRequestsError } from '@/common/utils'
import { createErrorFormatter } from '@/core/graphql/errors/format-graphql-error'

function failedWith(...errors: GraphQLError[]) {
  return { data: null, errors }
}

const unexpected = new GraphQLError('relation "monitor" does not exist', {
  path: ['monitor'],
  originalError: new Error('boom')
})

const format = createErrorFormatter({ debug: false })

describe('createErrorFormatter', () => {
  it('masks unexpected errors outside debug mode', () => {
    expect(format(failedWith(unexpected)).response.errors).toEqual([
      {
        message: 'Internal server error',
        path: ['monitor'],
        extensions: { code: 'INTERNAL_SERVER_ERROR' }
      }
    ])
  })

  it('keeps unexpected errors verbatim in debug mode', () => {
    expect(
      createErrorFormatter({ debug: true })(failedWith(unexpected)).response
        .errors
    ).toEqual([unexpected.toJSON()])
  })

  it('unwraps an AppError carried by the GraphQL error', () => {
    const wrapped = new GraphQLError('wrapped', {
      path: ['monitor'],
      originalError: new NotFoundError('Nothing here')
    })

    expect(format(failedWith(wrapped)).response.errors).toEqual([
      {
        message: 'Nothing here',
        path: ['monitor'],
        extensions: { code: 'NOT_FOUND' }
      }
    ])
  })

  it('reports validation messages as BAD_USER_INPUT', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: ['name must be longer than or equal to 1 characters']
    })
    const raised = new GraphQLError('ignored', {
      path: ['monitor'],
      originalError: exception
    })

    expect(format(failedWith(raised)).response.errors).toEqual([
      {
        message: 'Validation failed',
        path: ['monitor'],
        extensions: {
          code: 'BAD_USER_INPUT',
          errors: ['name must be longer than or equal to 1 characters']
        }
      }
    ])
  })

  it('maps other http exceptions by status', () => {
    const raised = new GraphQLError('ignored', {
      path: ['monitor'],
      originalError: new NotFoundException('gone')
    })

    expect(format(failedWith(raised)).response.errors).toEqual([
      {
        message: 'gone',
        path: ['monitor'],
        extensions: { code: 'NOT_FOUND' }
      }
    ])
  })

  it('passes an already classified error through', () => {
    const classified = new GraphQLError(
      'Query depth 13 exceeds the limit of 12',
      { extensions: { code: 'BAD_USER_INPUT' } }
    )

    expect(format(failedWith(classified)).response.errors).toEqual([
      classified.toJSON()
    ])
  })

  it('names an error the schema itself refused', () => {
    const refused = new GraphQLError(
      'Expected value of type "MonitorMethod!", found null.'
    )

    expect(format(failedWith(refused)).response.errors).toEqual([
      {
        message: 'Expected value of type "MonitorMethod!", found null.',
        locations: undefined,
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
      }
    ])
  })

  it('reports the fields the schema refused, not the wrapper around them', () => {
    const wrapper = new GraphQLError('Graphql validation error', {
      originalError: Object.assign(new Error('Graphql validation error'), {
        errors: [
          new GraphQLError('Cannot query field "nope" on type "Monitor".'),
          new GraphQLError('Cannot query field "gone" on type "Monitor".')
        ]
      })
    })

    expect(format(failedWith(wrapper)).response.errors).toEqual([
      {
        message: 'Cannot query field "nope" on type "Monitor".',
        locations: undefined,
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
      },
      {
        message: 'Cannot query field "gone" on type "Monitor".',
        locations: undefined,
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
      }
    ])
  })

  it('answers 429 when the client has spent its budget', () => {
    const throttled = new GraphQLError(
      'Rate limit reached, retry in 7 seconds',
      {
        path: ['monitors'],
        originalError: new TooManyRequestsError('Rate limit reached')
      }
    )

    expect(format(failedWith(throttled)).statusCode).toBe(429)
  })

  it('answers 400 when nothing reached a resolver and 200 when a field failed', () => {
    const rejectedQuery = new GraphQLError(
      'Query depth 13 exceeds the limit of 12',
      {
        extensions: { code: 'BAD_USER_INPUT' }
      }
    )

    expect(format(failedWith(rejectedQuery)).statusCode).toBe(400)
    expect(format(failedWith(unexpected)).statusCode).toBe(200)
  })
})
