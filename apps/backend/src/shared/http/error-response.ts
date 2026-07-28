import { ApiError } from './api-error.js';

export interface ApiResponse {
  status: number;
  body: unknown;
}

function unexpectedApiError(): ApiError<'UNEXPECTED_ERROR'> {
  return new ApiError(500, 'UNEXPECTED_ERROR', 'An unexpected error occurred.');
}

function isApiError(error: unknown): error is ApiError<string> {
  return error instanceof ApiError;
}

export function toErrorResponse(error: unknown): ApiResponse {
  const safeError = isApiError(error) ? error : unexpectedApiError();

  return {
    status: safeError.status,
    body: {
      error: {
        code: safeError.code,
        message: safeError.message,
        details: safeError.details,
      },
    },
  };
}
