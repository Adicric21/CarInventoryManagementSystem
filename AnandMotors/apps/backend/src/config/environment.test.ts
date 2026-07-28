import { describe, expect, it } from 'vitest';

import { EnvironmentValidationError, loadEnvironment } from './environment.js';

const VALID_ENVIRONMENT = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/dealership',
  JWT_SECRET: 'test-only-jwt-secret-at-least-32-characters',
  JWT_EXPIRES_IN: '3600',
} satisfies NodeJS.ProcessEnv;

describe('authentication environment', () => {
  it('loads validated configuration with safe defaults', () => {
    expect(loadEnvironment(VALID_ENVIRONMENT)).toEqual({
      databaseUrl: VALID_ENVIRONMENT.DATABASE_URL,
      jwtSecret: VALID_ENVIRONMENT.JWT_SECRET,
      jwtExpiresInSeconds: 3600,
      lowStockThreshold: 3,
      port: 3000,
      nodeEnv: 'development',
    });
  });

  it.each([
    ['missing JWT secret', { ...VALID_ENVIRONMENT, JWT_SECRET: undefined }],
    ['weak JWT secret', { ...VALID_ENVIRONMENT, JWT_SECRET: 'too-short' }],
    [
      'the documented JWT placeholder',
      {
        ...VALID_ENVIRONMENT,
        JWT_SECRET: 'REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS',
      },
    ],
    ['missing JWT expiry', { ...VALID_ENVIRONMENT, JWT_EXPIRES_IN: undefined }],
    ['invalid JWT expiry', { ...VALID_ENVIRONMENT, JWT_EXPIRES_IN: 'never' }],
  ])('rejects %s', (_description, environment) => {
    expect(() => loadEnvironment(environment)).toThrow(EnvironmentValidationError);
  });

  it.each(['-1', '1.5', 'not-a-number'])(
    'rejects invalid low-stock threshold %s',
    (LOW_STOCK_THRESHOLD) => {
      expect(() => loadEnvironment({ ...VALID_ENVIRONMENT, LOW_STOCK_THRESHOLD })).toThrow(
        EnvironmentValidationError,
      );
    },
  );
});
