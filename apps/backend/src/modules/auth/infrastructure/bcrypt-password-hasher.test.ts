import { describe, expect, it } from 'vitest';

import { BcryptPasswordHasher } from './bcrypt-password-hasher.js';

describe('bcrypt password hasher', () => {
  it('stores a salted hash and securely verifies credentials', async () => {
    const hasher = new BcryptPasswordHasher(10);
    const password = 'StrongPassword123';

    const passwordHash = await hasher.hash(password);

    expect(passwordHash).not.toBe(password);
    await expect(hasher.verify(password, passwordHash)).resolves.toBe(true);
    await expect(hasher.verify('IncorrectPassword123', passwordHash)).resolves.toBe(false);
  });

  it('rejects an unsafe work factor', () => {
    expect(() => new BcryptPasswordHasher(4)).toThrow(RangeError);
  });
});
