import type { StoredUser, UserRole } from './auth-types.js';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | null>;
  create(input: CreateUserInput): Promise<StoredUser>;
}

export class DuplicateEmailPersistenceError extends Error {
  constructor() {
    super('The normalized email is already in use.');
    this.name = 'DuplicateEmailPersistenceError';
  }
}
