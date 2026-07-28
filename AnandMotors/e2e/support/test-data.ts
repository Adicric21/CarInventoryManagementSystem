import { randomBytes, randomUUID } from 'node:crypto';

import { expect, test as base } from '@playwright/test';

import { BcryptPasswordHasher } from '../../apps/backend/src/modules/auth/infrastructure/bcrypt-password-hasher.js';
import { createPrismaClient } from '../../apps/backend/src/modules/auth/infrastructure/prisma-client.js';

export interface TestAccount {
  email: string;
  name: string;
  password: string;
}

export interface TestVehicleInput {
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

function testDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];

  if (value === undefined) {
    throw new Error('TEST_DATABASE_URL is required for E2E data fixtures.');
  }

  return value;
}

function generatedPassword(): string {
  return `E2e-Aa1-${randomBytes(18).toString('base64url')}`;
}

export class TestDataScope {
  public readonly marker = `e2e-${randomUUID()}`;

  private readonly prisma = createPrismaClient(testDatabaseUrl());
  private readonly userEmails = new Set<string>();
  private readonly vehicleCategories = new Set<string>();
  private readonly vehicleIds = new Set<string>();

  public newAccount(name: string): TestAccount {
    const account = {
      name,
      email: `${this.marker}-${randomUUID()}@example.invalid`,
      password: generatedPassword(),
    };
    this.userEmails.add(account.email);

    return account;
  }

  public async createAccount(
    role: 'USER' | 'ADMIN',
    name: string,
    emailPrefix?: string,
  ): Promise<TestAccount> {
    const account = this.newAccount(name);
    if (emailPrefix !== undefined) {
      this.userEmails.delete(account.email);
      account.email = `${emailPrefix}-${this.marker.slice(-6)}@example.com`;
      this.userEmails.add(account.email);
    }
    const passwordHash = await new BcryptPasswordHasher(10).hash(account.password);

    await this.prisma.user.create({
      data: {
        name: account.name,
        email: account.email,
        passwordHash,
        role,
      },
    });

    return account;
  }

  public trackVehicleCategory(category: string): void {
    this.vehicleCategories.add(category);
  }

  public async createVehicle(input: TestVehicleInput) {
    const vehicle = await this.prisma.vehicle.create({ data: input });
    this.vehicleIds.add(vehicle.id);

    return vehicle;
  }

  public async cleanup(): Promise<void> {
    const cleanupErrors: unknown[] = [];

    try {
      if (this.vehicleIds.size > 0) {
        try {
          await this.prisma.vehicle.deleteMany({
            where: { id: { in: [...this.vehicleIds] } },
          });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }

      if (this.vehicleCategories.size > 0) {
        try {
          await this.prisma.vehicle.deleteMany({
            where: { category: { in: [...this.vehicleCategories] } },
          });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }

      if (this.userEmails.size > 0) {
        try {
          await this.prisma.inventoryActivity.deleteMany({
            where: { performedBy: { email: { in: [...this.userEmails] } } },
          });
          await this.prisma.purchase.deleteMany({
            where: { user: { email: { in: [...this.userEmails] } } },
          });
          await this.prisma.user.deleteMany({
            where: { email: { in: [...this.userEmails] } },
          });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    } finally {
      try {
        await this.prisma.$disconnect();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'E2E test data cleanup failed.');
    }
  }
}

interface TestFixtures {
  testData: TestDataScope;
}

export const test = base.extend<TestFixtures>({
  testData: async ({ page: _page }, use) => {
    const scope = new TestDataScope();

    try {
      await use(scope);
    } finally {
      await scope.cleanup();
    }
  },
});

export { expect };
