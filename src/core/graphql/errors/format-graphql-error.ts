import { HttpException, HttpStatus } from '@nestjs/common'
import { GraphQLError } from 'graphql'
import type {
  ExecutionResult,
  FormattedExecutionResult,
  GraphQLFormattedError
} from 'graphql'

import { AppError, TooManyRequestsError } from '@/common/utils'

export type ErrorFormatterOptions = { debug: boolean }

export type FailedExecution = ExecutionResult &
  Required<Pick<ExecutionResult, 'errors'>>

export type FormattedFailure = {
  statusCode: number
  response: FormattedExecutionResult
}

export type ErrorFormatter = (execution: FailedExecution) => FormattedFailure

type NestedErrors = { errors?: readonly Error[] }

const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'

const BAD_USER_INPUT = 'BAD_USER_INPUT'

const GRAPHQL_VALIDATION_FAILED = 'GRAPHQL_VALIDATION_FAILED'

const HTTP_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: BAD_USER_INPUT,
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: TooManyRequestsError.code
}

export function createErrorFormatter({
  debug
}: ErrorFormatterOptions): ErrorFormatter {
  return (execution) => {
    const errors = execution.errors
      .flatMap(carriedErrors)
      .map((error) => formatOne(error, debug))

    return {
      statusCode: statusFor(errors),
      response: { data: execution.data, errors }
    }
  }
}

function carriedErrors(error: GraphQLError): GraphQLError[] {
  const nested = (error.originalError as NestedErrors | undefined)?.errors

  if (!nested) {
    return [error]
  }

  return nested.map((each) =>
    each instanceof GraphQLError
      ? each
      : new GraphQLError(each.message, { originalError: each })
  )
}

function formatOne(error: GraphQLError, debug: boolean): GraphQLFormattedError {
  const original = error.originalError

  if (original instanceof AppError) {
    return {
      message: original.message,
      path: error.path,
      extensions: { code: original.code }
    }
  }

  if (original instanceof HttpException) {
    return formatHttpException(original, error)
  }

  const formatted = error.toJSON()
  const code = formatted.extensions?.code

  if (typeof code === 'string' && code !== INTERNAL_SERVER_ERROR) {
    return formatted
  }

  if (!original) {
    return {
      message: formatted.message,
      locations: formatted.locations,
      extensions: { code: GRAPHQL_VALIDATION_FAILED }
    }
  }

  if (debug) {
    return formatted
  }

  return {
    message: 'Internal server error',
    path: formatted.path,
    extensions: { code: INTERNAL_SERVER_ERROR }
  }
}

function formatHttpException(
  exception: HttpException,
  error: GraphQLError
): GraphQLFormattedError {
  const response = exception.getResponse()
  const messages = validationMessages(response)

  if (messages) {
    return {
      message: 'Validation failed',
      path: error.path,
      extensions: { code: BAD_USER_INPUT, errors: messages }
    }
  }

  return {
    message: exception.message,
    path: error.path,
    extensions: {
      code: HTTP_CODE_MAP[exception.getStatus()] ?? 'HTTP_EXCEPTION'
    }
  }
}

function validationMessages(response: unknown): string[] | null {
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response &&
    Array.isArray(response.message)
  ) {
    return (response as { message: string[] }).message
  }

  return null
}

function statusFor(errors: readonly GraphQLFormattedError[]): number {
  if (
    errors.some((error) => error.extensions?.code === TooManyRequestsError.code)
  ) {
    return HttpStatus.TOO_MANY_REQUESTS
  }

  if (errors.every((error) => !error.path)) {
    return HttpStatus.BAD_REQUEST
  }

  return HttpStatus.OK
}
