import type { MessageDescriptor } from '@lingui/core'

export type ErrorMessage = string | MessageDescriptor

export abstract class AppError extends Error {
  public readonly descriptor: MessageDescriptor | undefined

  public abstract readonly code: string

  protected constructor(message: ErrorMessage, options?: ErrorOptions) {
    const descriptor = typeof message === 'string' ? undefined : message

    super(
      typeof message === 'string' ? message : (descriptor?.message ?? ''),
      options
    )

    this.descriptor = descriptor
    this.name = new.target.name
  }
}

export class ConflictError extends AppError {
  public readonly code = 'CONFLICT'

  constructor(message: ErrorMessage = 'Conflict', options?: ErrorOptions) {
    super(message, options)
  }
}

export class BadUserInputError extends AppError {
  public readonly code = 'BAD_USER_INPUT'

  constructor(message: ErrorMessage = 'Invalid query input') {
    super(message)
  }
}

export class TooManyRequestsError extends AppError {
  public readonly code = 'TOO_MANY_REQUESTS'

  constructor(
    message: ErrorMessage = 'Too many requests',
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

export class NotFoundError extends AppError {
  public readonly code = 'NOT_FOUND'

  constructor(message: ErrorMessage = 'Not found', options?: ErrorOptions) {
    super(message, options)
  }
}
