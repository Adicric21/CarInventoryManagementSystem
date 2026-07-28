import { z } from 'zod';

const postgresUrlSchema = z
  .url()
  .refine((url) => ['postgres:', 'postgresql:'].includes(new URL(url).protocol), {
    message: 'must be a PostgreSQL connection URL',
  });

const environmentSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema,
    TEST_DATABASE_URL: postgresUrlSchema.optional(),
    JWT_SECRET: z
      .string()
      .min(32, 'must contain at least 32 characters')
      .refine((secret) => !secret.startsWith('REPLACE_WITH_'), {
        message: 'must be replaced with a private random value',
      }),
    JWT_EXPIRES_IN: z.coerce.number().int().positive(),
    LOW_STOCK_THRESHOLD: z.coerce.number().int().nonnegative().max(2_147_483_647).default(3),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .transform((environment) => {
    const testDatabase =
      environment.TEST_DATABASE_URL === undefined
        ? {}
        : { testDatabaseUrl: environment.TEST_DATABASE_URL };

    return {
      databaseUrl: environment.DATABASE_URL,
      ...testDatabase,
      jwtSecret: environment.JWT_SECRET,
      jwtExpiresInSeconds: environment.JWT_EXPIRES_IN,
      lowStockThreshold: environment.LOW_STOCK_THRESHOLD,
      port: environment.PORT,
      nodeEnv: environment.NODE_ENV,
    };
  });

export type Environment = z.output<typeof environmentSchema>;

export class EnvironmentValidationError extends Error {
  public constructor(issues: readonly z.core.$ZodIssue[]) {
    const details = issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('; ');

    super(`Invalid environment configuration: ${details}`);
    this.name = 'EnvironmentValidationError';
  }
}

export const loadEnvironment = (environment: NodeJS.ProcessEnv = process.env): Environment => {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new EnvironmentValidationError(result.error.issues);
  }

  return result.data;
};
