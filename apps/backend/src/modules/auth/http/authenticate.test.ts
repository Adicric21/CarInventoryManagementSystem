import { describe, expect, it } from 'vitest';

import type { ApiRequest, ApiResponse } from '../test-support/auth-contracts.js';
import { createTokenProviderDouble } from '../test-support/auth-doubles.js';
import { createAuthenticatedUser } from '../test-support/auth-fixtures.js';
import { createAuthenticatorSubject } from '../test-support/auth-subjects.js';

const PROTECTED_PATH = '/api/admin/inventory';

function createProtectedRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    path: PROTECTED_PATH,
    ...overrides,
  };
}

function expectUnauthorized(response: ApiResponse | undefined): void {
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

describe('authentication middleware', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const tokenProvider = createTokenProviderDouble();
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(createProtectedRequest());

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).not.toHaveBeenCalled();
  });

  it('returns 401 for an authorization scheme other than Bearer', async () => {
    const tokenProvider = createTokenProviderDouble();
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Basic dXNlcjpwYXNzd29yZA==' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header contains only Bearer', async () => {
    const tokenProvider = createTokenProviderDouble();
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).not.toHaveBeenCalled();
  });

  it('returns 401 when the Bearer token is empty whitespace', async () => {
    const tokenProvider = createTokenProviderDouble();
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer   ' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is malformed', async () => {
    const tokenProvider = createTokenProviderDouble();
    tokenProvider.verify.mockRejectedValueOnce(new Error('malformed-token-internal-detail'));
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer not-a-jwt' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).toHaveBeenCalledWith('not-a-jwt');
  });

  it('returns 401 when token signature verification fails', async () => {
    const tokenProvider = createTokenProviderDouble();
    tokenProvider.verify.mockRejectedValueOnce(new Error('signature-internal-detail'));
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer invalid-signature-token' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).toHaveBeenCalledWith('invalid-signature-token');
  });

  it('returns 401 when the token is expired', async () => {
    const tokenProvider = createTokenProviderDouble();
    tokenProvider.verify.mockRejectedValueOnce(new Error('expired-at-internal-detail'));
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer expired-token' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).toHaveBeenCalledWith('expired-token');
  });

  it('returns 401 when the token does not provide required identity claims', async () => {
    const tokenProvider = createTokenProviderDouble();
    tokenProvider.verify.mockRejectedValueOnce(new Error('missing-claims-internal-detail'));
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer incomplete-token' } }),
    );

    expectUnauthorized(result.response);
    expect(tokenProvider.verify).toHaveBeenCalledWith('incomplete-token');
  });

  it('allows a request with a valid token and adds authenticated user context', async () => {
    const tokenProvider = createTokenProviderDouble();
    const verifiedPayload = createAuthenticatedUser({
      sub: 'authenticated-user-id',
      email: 'authenticated@example.com',
      role: 'ADMIN',
    });
    tokenProvider.verify.mockResolvedValueOnce(verifiedPayload);
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer valid-token' } }),
    );

    expect(result.response).toBeUndefined();
    expect(result.context).toEqual({
      user: {
        id: 'authenticated-user-id',
        email: 'authenticated@example.com',
        role: 'ADMIN',
      },
    });
    expect(result.context?.user).toMatchObject({
      id: 'authenticated-user-id',
      email: 'authenticated@example.com',
      role: 'ADMIN',
    });
    expect(tokenProvider.verify).toHaveBeenCalledWith('valid-token');
  });

  it('uses the standard error response without exposing token verification details', async () => {
    const tokenProvider = createTokenProviderDouble();
    const internalDetail = 'verification-internal-detail-do-not-expose';
    tokenProvider.verify.mockRejectedValueOnce(new Error(internalDetail));
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({ headers: { authorization: 'Bearer rejected-token' } }),
    );

    expectUnauthorized(result.response);
    expect(JSON.stringify(result.response?.body)).not.toContain(internalDetail);
    expect(JSON.stringify(result.response?.body)).not.toContain('stack');
  });

  it('does not allow client body fields to override authenticated identity', async () => {
    const tokenProvider = createTokenProviderDouble();
    const verifiedPayload = createAuthenticatedUser({ sub: 'server-user-id', role: 'USER' });
    tokenProvider.verify.mockResolvedValueOnce(verifiedPayload);
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: { userId: 'client-user-id', sub: 'client-user-id' },
      }),
    );

    expect(result.context?.user.id).toBe('server-user-id');
    expect(result.context?.user.id).not.toBe('client-user-id');
  });

  it('does not allow client body fields to override the authenticated role', async () => {
    const tokenProvider = createTokenProviderDouble();
    const verifiedPayload = createAuthenticatedUser({ sub: 'server-user-id', role: 'USER' });
    tokenProvider.verify.mockResolvedValueOnce(verifiedPayload);
    const authenticator = createAuthenticatorSubject(tokenProvider);

    const result = await authenticator.authenticate(
      createProtectedRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: { role: 'ADMIN' },
      }),
    );

    expect(result.context?.user.role).toBe('USER');
    expect(result.context?.user.role).not.toBe('ADMIN');
  });
});
