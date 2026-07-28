import { forbiddenError, unauthorizedError } from '../domain/auth-errors.js';
import { isUserRole } from '../domain/auth-types.js';
import { toErrorResponse } from './error-response.js';
import type { AuthorizationInput, AuthorizationResult, Authorizer } from './http-contracts.js';

export class AuthorizationService implements Authorizer {
  authorize(input: AuthorizationInput): Promise<AuthorizationResult> {
    const authenticatedRole = input.context?.user.role;

    if (authenticatedRole === undefined) {
      return Promise.resolve({
        allowed: false,
        response: toErrorResponse(unauthorizedError()),
      });
    }

    const hasRequiredRole =
      isUserRole(authenticatedRole) &&
      (authenticatedRole === 'ADMIN' || authenticatedRole === input.requiredRole);

    if (!hasRequiredRole) {
      return Promise.resolve({
        allowed: false,
        response: toErrorResponse(forbiddenError()),
      });
    }

    return Promise.resolve({ allowed: true });
  }
}
