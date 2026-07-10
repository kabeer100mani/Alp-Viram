/**
 * Typed application errors. Every thrown error should be an AppError (or a
 * subclass) so we always have a stable `code` to branch on and log.
 */
export class AppError extends Error {
  readonly code: string

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
    this.code = code
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'VALIDATION_ERROR', options)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'NOT_FOUND', options)
  }
}

export class AuthError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'AUTH_ERROR', options)
  }
}
