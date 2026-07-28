import { beforeEach, describe, expect, it } from 'vitest';

import type { ApiRequest, ApiResponse } from '../test-support/auth-contracts.js';
import { createAuthDependencies } from '../test-support/auth-doubles.js';
import {
  createPublicUserFixture,
  createRegistrationInput,
  createUserFixture,
} from '../test-support/auth-fixtures.js';
import { createAuthApiSubject } from '../test-support/auth-subjects.js';

function registrationRequest(body: unknown): ApiRequest {
  return {
    method: 'POST',
    path: '/api/auth/register',
    headers: { 'content-type': 'application/json' },
    body,
  };
}

interface ErrorEnvelope {
  error: {
    code: unknown;
    message: unknown;
    details: unknown;
  };
}

function readErrorEnvelope(body: unknown): ErrorEnvelope {
  expect(body).toBeTypeOf('object');
  expect(body).not.toBeNull();
  expect(body).toHaveProperty('error');

  return body as ErrorEnvelope;
}

function expectStandardError(response: ApiResponse, status: number, code: string): void {
  const { error } = readErrorEnvelope(response.body);

  expect(response.status).toBe(status);
  expect(error.code).toBe(code);
  expect(typeof error.message).toBe('string');
  expect(typeof error.details).toBe('object');
  expect(error.details).not.toBeNull();
}

describe('POST /api/auth/register', () => {
  let dependencies: ReturnType<typeof createAuthDependencies>;
  let authApi: ReturnType<typeof createAuthApiSubject>;

  beforeEach(() => {
    dependencies = createAuthDependencies();
    authApi = createAuthApiSubject(dependencies);
  });

  it('returns 201 for valid registration details', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ email: 'Mahadev@Example.com ' })),
    );

    expect(response.status).toBe(201);
  });

  it('returns a sanitized user in the success response', async () => {
    const response = await authApi.request(registrationRequest(createRegistrationInput()));

    expect(response.body).toEqual({
      data: { user: createPublicUserFixture() },
    });
  });

  it('returns the normalized email', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ email: '  Mahadev@Example.COM  ' })),
    );

    expect(response.body).toMatchObject({
      data: { user: { email: 'mahadev@example.com' } },
    });
  });

  it('returns USER as the registered role', async () => {
    const response = await authApi.request(registrationRequest(createRegistrationInput()));

    expect(response.body).toMatchObject({ data: { user: { role: 'USER' } } });
  });

  it('does not expose the plain password', async () => {
    const response = await authApi.request(registrationRequest(createRegistrationInput()));

    expect(response.body).toMatchObject({ data: { user: createPublicUserFixture() } });
    expect(JSON.stringify(response.body)).not.toContain('password');
  });

  it('does not expose the password hash', async () => {
    const response = await authApi.request(registrationRequest(createRegistrationInput()));

    expect(response.body).toMatchObject({ data: { user: createPublicUserFixture() } });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('returns 409 when the normalized email already exists', async () => {
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());

    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ email: ' MAHADEV@example.com ' })),
    );

    expect(response.status).toBe(409);
  });

  it('uses the stable EMAIL_ALREADY_EXISTS code for a duplicate email', async () => {
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());

    const response = await authApi.request(registrationRequest(createRegistrationInput()));

    expectStandardError(response, 409, 'EMAIL_ALREADY_EXISTS');
  });

  it('returns 400 when the name is missing', async () => {
    const response = await authApi.request(
      registrationRequest({
        email: 'mahadev@example.com',
        password: 'StrongPassword123',
      }),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the name is blank', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ name: '   ' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the email is missing', async () => {
    const response = await authApi.request(
      registrationRequest({ name: 'Mahadev', password: 'StrongPassword123' }),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the email format is invalid', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ email: 'not-an-email' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the password is missing', async () => {
    const response = await authApi.request(
      registrationRequest({ name: 'Mahadev', email: 'mahadev@example.com' }),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the password is shorter than eight characters', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ password: 'Abc1234' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the password has no uppercase character', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ password: 'strongpassword123' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the password has no lowercase character', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ password: 'STRONGPASSWORD123' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when the password has no number', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ password: 'StrongPassword' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await authApi.request(registrationRequest('{"name":'));

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('ignores a supplied ADMIN role and creates a USER account', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ role: 'ADMIN' })),
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ data: { user: { role: 'USER' } } });
    expect(dependencies.userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'USER' }),
    );
  });

  it('uses the shared error response shape for validation failures', async () => {
    const response = await authApi.request(
      registrationRequest(createRegistrationInput({ email: 'invalid' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('does not expose internal details when registration fails unexpectedly', async () => {
    dependencies.userRepository.create.mockRejectedValue(
      new Error('Prisma connection stack and credentials'),
    );

    const response = await authApi.request(registrationRequest(createRegistrationInput()));

    expectStandardError(response, 500, 'UNEXPECTED_ERROR');
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|credentials|stack/i);
  });
});
