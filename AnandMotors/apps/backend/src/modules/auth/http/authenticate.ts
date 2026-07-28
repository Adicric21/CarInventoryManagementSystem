import { isUserRole } from '../domain/auth-types.js';
import { unauthorizedError } from '../domain/auth-errors.js';
import type { TokenProvider } from '../domain/token-provider.js';
import { toErrorResponse } from './error-response.js';
import type { ApiRequest, AuthenticationResult, Authenticator } from './http-contracts.js';

function readAuthorizationHeader(request: ApiRequest): string | undefined {
  const entry = Object.entries(request.headers ?? {}).find(
    ([name]) => name.toLowerCase() === 'authorization',
  );

  return entry?.[1];
}

function readBearerToken(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1];
}

function hasValidIdentityClaims(payload: { sub: string; email: string; role: string }): boolean {
  return (
    payload.sub.trim().length > 0 && payload.email.trim().length > 0 && isUserRole(payload.role)
  );
}

export class AuthenticationService implements Authenticator {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async authenticate(request: ApiRequest): Promise<AuthenticationResult> {
    const token = readBearerToken(readAuthorizationHeader(request));

    if (token === undefined) {
      return { response: toErrorResponse(unauthorizedError()) };
    }

    try {
      const payload = await this.tokenProvider.verify(token);

      if (!hasValidIdentityClaims(payload)) {
        return { response: toErrorResponse(unauthorizedError()) };
      }

      return {
        context: {
          user: {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
          },
        },
      };
    } catch {
      return { response: toErrorResponse(unauthorizedError()) };
    }
  }
}
