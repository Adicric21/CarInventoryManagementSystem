import { describe, expect, it } from 'vitest';

import { createAuthDependencies } from '../test-support/auth-doubles.js';
import {
  createLoginInput,
  createUserFixture,
  GENERATED_ACCESS_TOKEN,
} from '../test-support/auth-fixtures.js';
import {
  createLoginUserSubject,
  MissingAuthenticationBehaviourError,
} from '../test-support/auth-subjects.js';

const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password.',
};

const UNEXPECTED_ERROR = {
  code: 'UNEXPECTED_ERROR',
  message: 'An unexpected error occurred.',
};

async function captureExpectedError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    if (error instanceof MissingAuthenticationBehaviourError) {
      throw error;
    }

    return error;
  }

  throw new Error('Expected the login operation to reject');
}

function expectInvalidCredentials(error: unknown): void {
  expect(error).toMatchObject(INVALID_CREDENTIALS);
}

function expectSafeUnexpectedError(error: unknown, sensitiveDetail: string): void {
  expect(error).toMatchObject(UNEXPECTED_ERROR);
  expect(String(error)).not.toContain(sensitiveDetail);
}

describe('login user', () => {
  it('trims and lowercases the supplied email', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const loginUser = createLoginUserSubject(dependencies);

    await loginUser.execute(createLoginInput({ email: '  Mahadev@Example.COM  ' }));

    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith('mahadev@example.com');
  });

  it('looks up the user exactly once using the normalized email', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const loginUser = createLoginUserSubject(dependencies);

    await loginUser.execute(createLoginInput({ email: ' Mahadev@Example.com ' }));

    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledTimes(1);
    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith('mahadev@example.com');
  });

  it('passes the supplied password and stored hash to the password verifier', async () => {
    const dependencies = createAuthDependencies();
    const storedUser = createUserFixture({ passwordHash: 'stored-password-hash' });
    dependencies.userRepository.findByEmail.mockResolvedValue(storedUser);
    const loginUser = createLoginUserSubject(dependencies);

    await loginUser.execute(createLoginInput({ password: 'SuppliedPassword123' }));

    expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
      'SuppliedPassword123',
      'stored-password-hash',
    );
  });

  it('returns the generated access token for valid credentials', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const loginUser = createLoginUserSubject(dependencies);

    const result = await loginUser.execute(createLoginInput());

    expect(result.accessToken).toBe(GENERATED_ACCESS_TOKEN);
  });

  it('returns sanitized user information for valid credentials', async () => {
    const dependencies = createAuthDependencies();
    const storedUser = createUserFixture();
    dependencies.userRepository.findByEmail.mockResolvedValue(storedUser);
    const loginUser = createLoginUserSubject(dependencies);

    const result = await loginUser.execute(createLoginInput());

    expect(result.user).toEqual({
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      role: storedUser.role,
    });
  });

  it('never returns the stored password hash', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const loginUser = createLoginUserSubject(dependencies);

    const result = await loginUser.execute(createLoginInput());

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('password');
  });

  it('rejects an incorrect password with a generic authentication error', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    dependencies.passwordHasher.verify.mockResolvedValue(false);
    const loginUser = createLoginUserSubject(dependencies);

    const error = await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expectInvalidCredentials(error);
  });

  it('rejects an unknown email with a generic authentication error', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(null);
    const loginUser = createLoginUserSubject(dependencies);

    const error = await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expectInvalidCredentials(error);
  });

  it('uses the same error code and message for an unknown email and incorrect password', async () => {
    const unknownEmailDependencies = createAuthDependencies();
    const unknownEmailLogin = createLoginUserSubject(unknownEmailDependencies);
    const unknownEmailError = await captureExpectedError(() =>
      unknownEmailLogin.execute(createLoginInput()),
    );

    const incorrectPasswordDependencies = createAuthDependencies();
    incorrectPasswordDependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    incorrectPasswordDependencies.passwordHasher.verify.mockResolvedValue(false);
    const incorrectPasswordLogin = createLoginUserSubject(incorrectPasswordDependencies);
    const incorrectPasswordError = await captureExpectedError(() =>
      incorrectPasswordLogin.execute(createLoginInput()),
    );

    expect(unknownEmailError).toMatchObject(INVALID_CREDENTIALS);
    expect(incorrectPasswordError).toMatchObject(INVALID_CREDENTIALS);
  });

  it('does not reveal whether the supplied email or password was incorrect', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    dependencies.passwordHasher.verify.mockResolvedValue(false);
    const loginUser = createLoginUserSubject(dependencies);
    const input = createLoginInput({
      email: 'private-user@example.com',
      password: 'IncorrectPassword123',
    });

    const error = await captureExpectedError(() => loginUser.execute(input));

    expectInvalidCredentials(error);
    expect(String(error)).not.toContain(input.email);
    expect(String(error)).not.toContain(input.password);
  });

  it('does not generate a token when the user does not exist', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(null);
    const loginUser = createLoginUserSubject(dependencies);

    await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expect(dependencies.tokenProvider.generate).not.toHaveBeenCalled();
  });

  it('does not generate a token when password verification fails', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    dependencies.passwordHasher.verify.mockResolvedValue(false);
    const loginUser = createLoginUserSubject(dependencies);

    await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expect(dependencies.tokenProvider.generate).not.toHaveBeenCalled();
  });

  it('passes the user identity email and role to the token provider', async () => {
    const dependencies = createAuthDependencies();
    const storedUser = createUserFixture({ role: 'ADMIN' });
    dependencies.userRepository.findByEmail.mockResolvedValue(storedUser);
    const loginUser = createLoginUserSubject(dependencies);

    await loginUser.execute(createLoginInput());

    expect(dependencies.tokenProvider.generate).toHaveBeenCalledWith({
      sub: storedUser.id,
      email: storedUser.email,
      role: storedUser.role,
    });
  });

  it('handles a password-verifier failure without leaking sensitive details', async () => {
    const dependencies = createAuthDependencies();
    const sensitiveDetail = 'password verifier leaked salt';
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    dependencies.passwordHasher.verify.mockRejectedValue(new Error(sensitiveDetail));
    const loginUser = createLoginUserSubject(dependencies);

    const error = await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expectSafeUnexpectedError(error, sensitiveDetail);
    expect(dependencies.tokenProvider.generate).not.toHaveBeenCalled();
  });

  it('handles a token-provider failure without leaking sensitive details', async () => {
    const dependencies = createAuthDependencies();
    const sensitiveDetail = 'token provider leaked signing key';
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    dependencies.tokenProvider.generate.mockRejectedValue(new Error(sensitiveDetail));
    const loginUser = createLoginUserSubject(dependencies);

    const error = await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expectSafeUnexpectedError(error, sensitiveDetail);
  });

  it('handles a repository failure through the shared unexpected-error path', async () => {
    const dependencies = createAuthDependencies();
    const sensitiveDetail = 'repository leaked connection information';
    dependencies.userRepository.findByEmail.mockRejectedValue(new Error(sensitiveDetail));
    const loginUser = createLoginUserSubject(dependencies);

    const error = await captureExpectedError(() => loginUser.execute(createLoginInput()));

    expectSafeUnexpectedError(error, sensitiveDetail);
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled();
    expect(dependencies.tokenProvider.generate).not.toHaveBeenCalled();
  });
});
