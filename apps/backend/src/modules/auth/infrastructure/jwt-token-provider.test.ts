import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { JwtTokenProvider } from './jwt-token-provider.js';

const TEST_SECRET = 'test-only-jwt-secret-at-least-32-characters';

describe('JWT token provider', () => {
  it('signs and verifies the required identity claims', async () => {
    const provider = new JwtTokenProvider(TEST_SECRET, 3600);
    const payload = {
      sub: 'user-0001',
      email: 'mahadev@example.com',
      role: 'ADMIN',
    };

    const token = await provider.generate(payload);

    await expect(provider.verify(token)).resolves.toEqual(payload);
  });

  it('rejects a token signed with a different secret', async () => {
    const provider = new JwtTokenProvider(TEST_SECRET, 3600);
    const token = jwt.sign(
      { email: 'mahadev@example.com', role: 'USER' },
      'different-test-only-secret-at-least-32-characters',
      { subject: 'user-0001', expiresIn: 3600 },
    );

    await expect(provider.verify(token)).rejects.toThrow();
  });

  it('rejects expired tokens and unsupported roles', async () => {
    const provider = new JwtTokenProvider(TEST_SECRET, 3600);
    const expiredToken = jwt.sign({ email: 'mahadev@example.com', role: 'USER' }, TEST_SECRET, {
      subject: 'user-0001',
      expiresIn: -1,
    });
    const unsupportedRoleToken = jwt.sign(
      { email: 'mahadev@example.com', role: 'SUPER_ADMIN' },
      TEST_SECRET,
      { subject: 'user-0001', expiresIn: 3600 },
    );

    await expect(provider.verify(expiredToken)).rejects.toThrow();
    await expect(provider.verify(unsupportedRoleToken)).rejects.toThrow();
  });
});
