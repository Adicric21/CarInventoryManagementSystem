import { z } from 'zod';

import { loadRootEnvironment } from '../config/load-root-environment.js';
import { fitsBcryptPasswordLimit } from '../modules/auth/domain/password-policy.js';
import { BcryptPasswordHasher } from '../modules/auth/infrastructure/bcrypt-password-hasher.js';
import { createPrismaClient } from '../modules/auth/infrastructure/prisma-client.js';
import { PrismaUserRepository } from '../modules/auth/infrastructure/prisma-user-repository.js';
import { seedVehicleInventory } from './seed-vehicle-inventory.js';

const seedEnvironmentSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((url) => ['postgres:', 'postgresql:'].includes(new URL(url).protocol), {
      message: 'must be a PostgreSQL connection URL',
    }),
  ADMIN_NAME: z.string().trim().min(1).max(100),
  ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  ADMIN_PASSWORD: z
    .string()
    .min(8)
    .regex(/[a-z]/u, 'must contain a lowercase letter')
    .regex(/[A-Z]/u, 'must contain an uppercase letter')
    .regex(/[0-9]/u, 'must contain a number')
    .refine(fitsBcryptPasswordLimit, 'must not exceed 72 UTF-8 bytes'),
});

loadRootEnvironment();

class AdminSeedEnvironmentError extends Error {
  public constructor(issues: readonly z.core.$ZodIssue[]) {
    const details = issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('; ');

    super(`Invalid administrator seed configuration: ${details}`);
    this.name = 'AdminSeedEnvironmentError';
  }
}

const loadSeedEnvironment = (environment: NodeJS.ProcessEnv) => {
  const result = seedEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new AdminSeedEnvironmentError(result.error.issues);
  }

  return result.data;
};

const seedAdministrator = async (): Promise<void> => {
  const environment = loadSeedEnvironment(process.env);
  const prisma = createPrismaClient(environment.DATABASE_URL);

  try {
    const passwordHasher = new BcryptPasswordHasher();
    const userRepository = new PrismaUserRepository(prisma.user);
    const passwordHash = await passwordHasher.hash(environment.ADMIN_PASSWORD);

    const administrator = await userRepository.upsertAdmin({
      name: environment.ADMIN_NAME,
      email: environment.ADMIN_EMAIL,
      passwordHash,
    });
    const inventory = await seedVehicleInventory(prisma, administrator.id);

    console.info(
      `Application seed completed: administrator ready; ` +
        `${inventory.inserted} inventory vehicles inserted, ${inventory.skipped} already present.`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

try {
  await seedAdministrator();
} catch (error: unknown) {
  const message =
    error instanceof AdminSeedEnvironmentError ? error.message : 'Application seed failed.';

  console.error(message);
  process.exitCode = 1;
}
