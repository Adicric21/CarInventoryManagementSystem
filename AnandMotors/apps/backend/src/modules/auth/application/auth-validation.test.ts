import { describe, expect, it } from 'vitest';

import { parseLoginInput, parseRegistrationInput } from './auth-validation.js';

describe('bcrypt-safe password validation', () => {
  it('accepts a password exactly 72 UTF-8 bytes long', () => {
    expect(() =>
      parseRegistrationInput({
        name: 'Mahadev',
        email: 'mahadev@example.com',
        password: `StrongPassword123${'a'.repeat(55)}`,
      }),
    ).not.toThrow();
  });

  it('rejects registration passwords longer than 72 UTF-8 bytes', () => {
    expect(() =>
      parseRegistrationInput({
        name: 'Mahadev',
        email: 'mahadev@example.com',
        password: `StrongPassword123${'a'.repeat(56)}`,
      }),
    ).toThrow();
  });

  it('counts multibyte passwords by UTF-8 bytes', () => {
    expect(() =>
      parseLoginInput({
        email: 'mahadev@example.com',
        password: '\u{1F600}'.repeat(19),
      }),
    ).toThrow();
  });
});
