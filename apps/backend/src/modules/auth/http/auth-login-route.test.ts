import { describe, expect, it } from 'vitest';

import type { ApiRequest, ApiResponse } from '../test-support/auth-contracts.js';
import { createAuthDependencies } from '../test-support/auth-doubles.js';
import { createLoginInput, createUserFixture } from '../test-support/auth-fixtures.js';
import {
  createAuthApiSubject,
  MissingAuthenticationBehaviourError,
} from '../test-support/auth-subjects.js';

interface LoginResponseBody {
  data: {
    accessToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password.',
};

function createLoginRequest(body: unknown = createLoginInput()): ApiRequest {
  return {
    method: 'POST',
    path: '/api/auth/login',
    body,
  };
}

async function captureExpectedResponse(action: () => Promise<ApiResponse>): Promise<ApiResponse> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof MissingAuthenticationBehaviourError) {
      throw error;
    }

    throw error;
  }
}

function responseBody(response: ApiResponse): LoginResponseBody {
  return response.body as LoginResponseBody;
}

function errorBody(response: ApiResponse): ErrorResponseBody['error'] {
  return (response.body as ErrorResponseBody).error;
}

function expectStandardError(response: ApiResponse, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(errorBody(response).code).toBe(code);
  expect(typeof errorBody(response).message).toBe('string');
  expect(typeof errorBody(response).details).toBe('object');
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('error.stack');
}

describe('POST /api/auth/login', () => {
  it('returns 200 for valid credentials', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() => api.request(createLoginRequest()));

    expect(response.status).toBe(200);
  });

  it('returns a non-empty generated access token', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() => api.request(createLoginRequest()));

    expect(typeof responseBody(response).data.accessToken).toBe('string');
    expect(responseBody(response).data.accessToken).not.toHaveLength(0);
  });

  it('returns sanitized user information', async () => {
    const dependencies = createAuthDependencies();
    const storedUser = createUserFixture();
    dependencies.userRepository.findByEmail.mockResolvedValue(storedUser);
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() => api.request(createLoginRequest()));

    expect(responseBody(response).data.user).toEqual({
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      role: storedUser.role,
    });
  });

  it('does not expose password or passwordHash in the response', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() => api.request(createLoginRequest()));

    expect(response.body).not.toHaveProperty('data.user.password');
    expect(response.body).not.toHaveProperty('data.user.passwordHash');
  });

  it('normalizes email before authentication and in the returned user', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest(createLoginInput({ email: ' Mahadev@Example.COM ' }))),
    );

    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith('mahadev@example.com');
    expect(responseBody(response).data.user.email).toBe('mahadev@example.com');
  });

  it('returns 401 and the generic error for an incorrect password', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    dependencies.passwordHasher.verify.mockResolvedValue(false);
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() => api.request(createLoginRequest()));

    expectStandardError(response, 401, INVALID_CREDENTIALS.code);
    expect(errorBody(response).message).toBe(INVALID_CREDENTIALS.message);
  });

  it('returns 401 and the generic error for an unknown email', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(null);
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() => api.request(createLoginRequest()));

    expectStandardError(response, 401, INVALID_CREDENTIALS.code);
    expect(errorBody(response).message).toBe(INVALID_CREDENTIALS.message);
  });

  it('uses the same code and message for both invalid-credential cases', async () => {
    const unknownEmailDependencies = createAuthDependencies();
    const unknownEmailApi = createAuthApiSubject(unknownEmailDependencies);
    const unknownEmailResponse = await captureExpectedResponse(() =>
      unknownEmailApi.request(createLoginRequest()),
    );

    const incorrectPasswordDependencies = createAuthDependencies();
    incorrectPasswordDependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    incorrectPasswordDependencies.passwordHasher.verify.mockResolvedValue(false);
    const incorrectPasswordApi = createAuthApiSubject(incorrectPasswordDependencies);
    const incorrectPasswordResponse = await captureExpectedResponse(() =>
      incorrectPasswordApi.request(createLoginRequest()),
    );

    expect(errorBody(unknownEmailResponse)).toMatchObject(INVALID_CREDENTIALS);
    expect(errorBody(incorrectPasswordResponse)).toMatchObject(INVALID_CREDENTIALS);
  });

  it('returns 400 when email is missing', async () => {
    const dependencies = createAuthDependencies();
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest({ password: 'StrongPassword123' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when email format is invalid', async () => {
    const dependencies = createAuthDependencies();
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest(createLoginInput({ email: 'not-an-email' }))),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when password is missing', async () => {
    const dependencies = createAuthDependencies();
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest({ email: 'mahadev@example.com' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when password is empty', async () => {
    const dependencies = createAuthDependencies();
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest(createLoginInput({ password: '' }))),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
  });

  it('uses the shared error response format for validation failures', async () => {
    const dependencies = createAuthDependencies();
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest({ email: '', password: '' })),
    );

    expectStandardError(response, 400, 'VALIDATION_ERROR');
    expect(errorBody(response).details).toBeTypeOf('object');
  });

  it('does not expose internal details for authentication failures', async () => {
    const dependencies = createAuthDependencies();
    const sensitivePassword = 'IncorrectPassword123';
    const sensitiveHash = 'stored-sensitive-password-hash';
    dependencies.userRepository.findByEmail.mockResolvedValue(
      createUserFixture({ passwordHash: sensitiveHash }),
    );
    dependencies.passwordHasher.verify.mockResolvedValue(false);
    const api = createAuthApiSubject(dependencies);

    const response = await captureExpectedResponse(() =>
      api.request(createLoginRequest(createLoginInput({ password: sensitivePassword }))),
    );

    expectStandardError(response, 401, INVALID_CREDENTIALS.code);
    expect(JSON.stringify(response.body)).not.toContain(sensitivePassword);
    expect(JSON.stringify(response.body)).not.toContain(sensitiveHash);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('Prisma');
  });
});
