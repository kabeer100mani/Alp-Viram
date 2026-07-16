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

/**
 * The caller is authenticated but not allowed to perform this write.
 *
 * RLS denies *silently*: a forbidden UPDATE matches no rows and returns no
 * error, which is indistinguishable from success unless we check the affected
 * rows. Repositories translate that into this error so it can never be mistaken
 * for a successful write. See Doc 8 — Permission Model.
 */
export class PermissionError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'PERMISSION_DENIED', options)
  }
}
