import type { User as PrismaUser } from '../../../generated/prisma/client.js';
import type { StoredUser } from '../domain/auth-types.js';
import {
  DuplicateEmailPersistenceError,
  type CreateUserInput,
  type UserRepository,
} from '../domain/user-repository.js';

export type UpsertAdminInput = Omit<CreateUserInput, 'role'>;

export interface AuthUserDelegate {
  findUnique(input: { where: { email: string } }): Promise<PrismaUser | null>;
  create(input: { data: CreateUserInput }): Promise<PrismaUser>;
  upsert(input: {
    where: { email: string };
    create: CreateUserInput;
    update: {
      name: string;
      passwordHash: string;
      role: 'ADMIN';
    };
  }): Promise<PrismaUser>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const containsEmailField = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value === 'email' || value.split(/[^a-zA-Z0-9_]+/u).includes('email');
  }

  return Array.isArray(value) && value.some((entry) => entry === 'email');
};

const isEmailUniqueConstraintError = (error: unknown): boolean => {
  if (!isRecord(error) || error['code'] !== 'P2002' || !isRecord(error['meta'])) {
    return false;
  }

  if (containsEmailField(error['meta']['target'])) {
    return true;
  }

  const adapterError = error['meta']['driverAdapterError'];
  const cause = isRecord(adapterError) ? adapterError['cause'] : undefined;
  const constraint = isRecord(cause) ? cause['constraint'] : undefined;

  return isRecord(constraint) && containsEmailField(constraint['fields']);
};

const toStoredUser = (user: PrismaUser): StoredUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  passwordHash: user.passwordHash,
  role: user.role,
});

export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly users: AuthUserDelegate) {}

  public async findByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.users.findUnique({ where: { email } });

    return user === null ? null : toStoredUser(user);
  }

  public async create(input: CreateUserInput): Promise<StoredUser> {
    try {
      const user = await this.users.create({ data: input });

      return toStoredUser(user);
    } catch (error: unknown) {
      if (isEmailUniqueConstraintError(error)) {
        throw new DuplicateEmailPersistenceError();
      }

      throw error;
    }
  }

  public async upsertAdmin(input: UpsertAdminInput): Promise<StoredUser> {
    try {
      const user = await this.users.upsert({
        where: { email: input.email },
        create: { ...input, role: 'ADMIN' },
        update: {
          name: input.name,
          passwordHash: input.passwordHash,
          role: 'ADMIN',
        },
      });

      return toStoredUser(user);
    } catch (error: unknown) {
      if (isEmailUniqueConstraintError(error)) {
        throw new DuplicateEmailPersistenceError();
      }

      throw error;
    }
  }
}
