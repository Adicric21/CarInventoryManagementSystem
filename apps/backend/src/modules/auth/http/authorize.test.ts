import { describe, expect, it } from 'vitest';

import type {
  ApiRequest,
  ApiResponse,
  AuthenticatedContext,
} from '../test-support/auth-contracts.js';
import { createAuthenticatedContext } from '../test-support/auth-fixtures.js';
import { createAuthorizerSubject } from '../test-support/auth-subjects.js';

const ADMIN_OPERATION_PATH = '/api/admin/inventory';

function createAdminRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'POST',
    path: ADMIN_OPERATION_PATH,
    ...overrides,
  };
}

function createContext(role: string): AuthenticatedContext {
  return createAuthenticatedContext({ role });
}

function expectAuthenticationRequired(response: ApiResponse | undefined): void {
  expect(response).toMatchObject({
    status: 401,
    body: {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
        details: {},
      },
    },
  });
}

function expectForbidden(response: ApiResponse | undefined): void {
  expect(response).toMatchObject({
    status: 403,
    body: {
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        details: {},
      },
    },
  });
}

describe('administrator authorization', () => {
  it('allows an authenticated ADMIN to access an administrator-only operation', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('ADMIN'),
      request: createAdminRequest(),
      requiredRole: 'ADMIN',
    });

    expect(result).toEqual({ allowed: true });
  });

  it('returns 403 when an authenticated USER requests an administrator-only operation', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('USER'),
      request: createAdminRequest(),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectForbidden(result.response);
  });

  it('returns 401 for an unauthenticated request rather than treating it as forbidden', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      request: createAdminRequest(),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectAuthenticationRequired(result.response);
    expect(result.response?.status).not.toBe(403);
  });

  it('rejects an operation when authenticated context is missing', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      request: createAdminRequest(),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectAuthenticationRequired(result.response);
  });

  it('rejects an authenticated context containing an unsupported role', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('SUPER_ADMIN'),
      request: createAdminRequest(),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectForbidden(result.response);
  });

  it('uses the shared error response structure for an authorization failure', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('USER'),
      request: createAdminRequest(),
      requiredRole: 'ADMIN',
    });

    expectForbidden(result.response);
    expect(result.response?.body).toHaveProperty('error.code');
    expect(result.response?.body).toHaveProperty('error.message');
    expect(result.response?.body).toHaveProperty('error.details');
  });

  it('uses server-side authenticated context instead of client authorization claims', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('USER'),
      request: createAdminRequest({
        body: { authenticated: true, userId: 'administrator-id', role: 'ADMIN' },
        query: { role: 'ADMIN' },
        headers: { 'x-user-role': 'ADMIN' },
      }),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectForbidden(result.response);
  });

  it('ignores an administrator role supplied in the request body', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('USER'),
      request: createAdminRequest({ body: { role: 'ADMIN' } }),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectForbidden(result.response);
  });

  it('ignores an administrator role supplied in query parameters', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('USER'),
      request: createAdminRequest({ query: { role: 'ADMIN' } }),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectForbidden(result.response);
  });

  it('ignores an administrator role supplied in custom client headers', async () => {
    const authorizer = createAuthorizerSubject();

    const result = await authorizer.authorize({
      context: createContext('USER'),
      request: createAdminRequest({ headers: { 'x-user-role': 'ADMIN' } }),
      requiredRole: 'ADMIN',
    });

    expect(result.allowed).toBe(false);
    expectForbidden(result.response);
  });
});
