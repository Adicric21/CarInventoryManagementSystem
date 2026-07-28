import { vi } from 'vitest';

import type { PasswordHasher, TokenProvider, UserRepository } from './auth-contracts.js';
import {
  createAuthenticatedUser,
  createUserFixture,
  GENERATED_ACCESS_TOKEN,
  GENERATED_PASSWORD_HASH,
} from './auth-fixtures.js';

export function createUserRepositoryDouble() {
  const findByEmail = vi.fn<UserRepository['findByEmail']>((_email) => Promise.resolve(null));
  const create = vi.fn<UserRepository['create']>((input) =>
    Promise.resolve(createUserFixture(input)),
  );

  return { findByEmail, create } satisfies UserRepository;
}

export function createPasswordHasherDouble() {
  const hash = vi.fn<PasswordHasher['hash']>((_plainPassword) =>
    Promise.resolve(GENERATED_PASSWORD_HASH),
  );
  const verify = vi.fn<PasswordHasher['verify']>((_plainPassword, _passwordHash) =>
    Promise.resolve(true),
  );

  return { hash, verify } satisfies PasswordHasher;
}

export function createTokenProviderDouble() {
  const generate = vi.fn<TokenProvider['generate']>((_payload) =>
    Promise.resolve(GENERATED_ACCESS_TOKEN),
  );
  const verify = vi.fn<TokenProvider['verify']>((_token) =>
    Promise.resolve(createAuthenticatedUser()),
  );

  return { generate, verify } satisfies TokenProvider;
}

export function createAuthDependencies() {
  return {
    userRepository: createUserRepositoryDouble(),
    passwordHasher: createPasswordHasherDouble(),
    tokenProvider: createTokenProviderDouble(),
  };
}
