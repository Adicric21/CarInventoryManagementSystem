import { ApiError, type ErrorDetails } from '../../../shared/http/api-error.js';

export const AUTH_ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  emailAlreadyExists: 'EMAIL_ALREADY_EXISTS',
  invalidCredentials: 'INVALID_CREDENTIALS',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  unexpected: 'UNEXPECTED_ERROR',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export class AuthError extends ApiError<AuthErrorCode> {
  constructor(status: number, code: AuthErrorCode, message: string, details: ErrorDetails = {}) {
    super(status, code, message, details);
    this.name = 'AuthError';
  }
}

export type { ErrorDetails };

export function validationError(details: ErrorDetails): AuthError {
  return new AuthError(400, AUTH_ERROR_CODES.validation, 'The request is invalid.', details);
}

export function emailAlreadyExistsError(): AuthError {
  return new AuthError(
    409,
    AUTH_ERROR_CODES.emailAlreadyExists,
    'An account with this email already exists.',
  );
}

export function invalidCredentialsError(): AuthError {
  return new AuthError(401, AUTH_ERROR_CODES.invalidCredentials, 'Invalid email or password.');
}

export function unauthorizedError(): AuthError {
  return new AuthError(401, AUTH_ERROR_CODES.unauthorized, 'Authentication is required.');
}

export function forbiddenError(): AuthError {
  return new AuthError(
    403,
    AUTH_ERROR_CODES.forbidden,
    'You do not have permission to perform this action.',
  );
}

export function unexpectedError(): AuthError {
  return new AuthError(500, AUTH_ERROR_CODES.unexpected, 'An unexpected error occurred.');
}
