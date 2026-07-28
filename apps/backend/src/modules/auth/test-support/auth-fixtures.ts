import type {
  AuthenticatedContext,
  AuthenticatedUserContext,
  LoginInput,
  PublicUser,
  RegistrationInput,
  StoredUser,
  TokenPayload,
} from './auth-contracts.js';

export const GENERATED_PASSWORD_HASH = 'generated-password-hash';
export const GENERATED_ACCESS_TOKEN = 'generated-access-token';

export function createRegistrationInput(
  overrides: Partial<RegistrationInput> = {},
): RegistrationInput {
  return {
    name: 'Mahadev',
    email: 'mahadev@example.com',
    password: 'StrongPassword123',
    ...overrides,
  };
}

export function createLoginInput(overrides: Partial<LoginInput> = {}): LoginInput {
  return {
    email: 'mahadev@example.com',
    password: 'StrongPassword123',
    ...overrides,
  };
}

export function createUserFixture(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: 'user-0001',
    name: 'Mahadev',
    email: 'mahadev@example.com',
    passwordHash: GENERATED_PASSWORD_HASH,
    role: 'USER',
    ...overrides,
  };
}

export function createPublicUserFixture(overrides: Partial<PublicUser> = {}): PublicUser {
  const user = createUserFixture();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...overrides,
  };
}

export function createAuthenticatedUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  const user = createUserFixture();

  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    ...overrides,
  };
}

export function createAuthenticatedContext(
  overrides: Partial<AuthenticatedUserContext> = {},
): AuthenticatedContext {
  const tokenPayload = createAuthenticatedUser();

  return {
    user: {
      id: tokenPayload.sub,
      email: tokenPayload.email,
      role: tokenPayload.role,
      ...overrides,
    },
  };
}
