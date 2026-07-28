import { describe, expect, it, vi } from 'vitest';

import type { User as PrismaUser } from '../../../generated/prisma/client.js';
import { DuplicateEmailPersistenceError } from '../domain/user-repository.js';
import { type AuthUserDelegate, PrismaUserRepository } from './prisma-user-repository.js';

function createPrismaUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
  return {
    id: 'user-0001',
    name: 'Mahadev',
    email: 'mahadev@example.com',
    passwordHash: 'stored-password-hash',
    role: 'USER',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createDelegate() {
  const findUnique = vi.fn<AuthUserDelegate['findUnique']>(() => Promise.resolve(null));
  const create = vi.fn<AuthUserDelegate['create']>((input) =>
    Promise.resolve(createPrismaUser(input.data)),
  );
  const upsert = vi.fn<AuthUserDelegate['upsert']>((input) =>
    Promise.resolve(createPrismaUser(input.create)),
  );

  return { findUnique, create, upsert } satisfies AuthUserDelegate;
}

const CREATE_USER_INPUT = {
  name: 'Mahadev',
  email: 'mahadev@example.com',
  passwordHash: 'stored-password-hash',
  role: 'USER',
} as const;

describe('Prisma user repository', () => {
  it('maps persisted users to the internal authentication record', async () => {
    const delegate = createDelegate();
    delegate.findUnique.mockResolvedValue(createPrismaUser());
    const repository = new PrismaUserRepository(delegate);

    await expect(repository.findByEmail('mahadev@example.com')).resolves.toEqual({
      id: 'user-0001',
      name: 'Mahadev',
      email: 'mahadev@example.com',
      passwordHash: 'stored-password-hash',
      role: 'USER',
    });
    expect(delegate.findUnique).toHaveBeenCalledWith({
      where: { email: 'mahadev@example.com' },
    });
  });

  it('maps an email unique-constraint race to the safe domain error', async () => {
    const delegate = createDelegate();
    delegate.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    });
    const repository = new PrismaUserRepository(delegate);

    await expect(repository.create(CREATE_USER_INPUT)).rejects.toBeInstanceOf(
      DuplicateEmailPersistenceError,
    );
  });

  it('does not misclassify unrelated persistence failures', async () => {
    const delegate = createDelegate();
    const persistenceError = new Error('database unavailable');
    delegate.create.mockRejectedValue(persistenceError);
    const repository = new PrismaUserRepository(delegate);

    await expect(repository.create(CREATE_USER_INPUT)).rejects.toBe(persistenceError);
  });

  it('upserts an administrator with a trusted server-side role', async () => {
    const delegate = createDelegate();
    const repository = new PrismaUserRepository(delegate);

    await repository.upsertAdmin({
      name: 'Administrator',
      email: 'admin@example.com',
      passwordHash: 'administrator-password-hash',
    });

    expect(delegate.upsert).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      create: {
        name: 'Administrator',
        email: 'admin@example.com',
        passwordHash: 'administrator-password-hash',
        role: 'ADMIN',
      },
      update: {
        name: 'Administrator',
        passwordHash: 'administrator-password-hash',
        role: 'ADMIN',
      },
    });
  });
});
