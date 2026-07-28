import bcrypt from 'bcryptjs';

import type { PasswordHasher } from '../domain/password-hasher.js';

const DEFAULT_COST_FACTOR = 12;
const MINIMUM_COST_FACTOR = 10;
const MAXIMUM_COST_FACTOR = 15;

export class BcryptPasswordHasher implements PasswordHasher {
  public constructor(private readonly costFactor = DEFAULT_COST_FACTOR) {
    if (
      !Number.isInteger(costFactor) ||
      costFactor < MINIMUM_COST_FACTOR ||
      costFactor > MAXIMUM_COST_FACTOR
    ) {
      throw new RangeError(
        `Bcrypt cost factor must be an integer between ${MINIMUM_COST_FACTOR} and ${MAXIMUM_COST_FACTOR}.`,
      );
    }
  }

  public async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.costFactor);
  }

  public async verify(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
