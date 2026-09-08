import { ApolloServerErrorCode } from '@apollo/server/errors'
import { HttpException, HttpStatus } from '@nestjs/common'
import { type GraphQLFormattedError, GraphQLError } from 'graphql'

import { AppError, isDev } from '@/common/utils'

const HTTP_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ApolloServerErrorCode.BAD_USER_INPUT,
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS'
}

export function formatGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown
): GraphQLFormattedError {
  const original = unwrapOriginalError(error)

  if (original instanceof AppError) {
    return {
      message: original.message,
      path: formattedError.path,
      extensions: { code: original.code }
    }
  }

  if (original instanceof HttpException) {
    return formatHttpException(original, formattedError)
  }

  if (!isDev() && isInternalError(formattedError)) {
    return {
      message: 'Internal server error',
      path: formattedError.path,
      extensions: { code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR }
    }
  }

  return formattedError
}

function unwrapOriginalError(error: unknown): unknown {
  if (error instanceof GraphQLError && error.originalError) {
    return error.originalError
  }

  return error
}

function formatHttpException(
  exception: HttpException,
  formattedError: GraphQLFormattedError
): GraphQLFormattedError {
  const response = exception.getResponse()
  const messages = validationMessages(response)

  if (messages) {
    return {
      message: 'Validation failed',
      path: formattedError.path,
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
        errors: messages
      }
    }
  }

  return {
    message: exception.message,
    path: formattedError.path,
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

function isInternalError(formattedError: GraphQLFormattedError): boolean {
  const code = formattedError.extensions?.code

  return !code || code === ApolloServerErrorCode.INTERNAL_SERVER_ERROR
}
