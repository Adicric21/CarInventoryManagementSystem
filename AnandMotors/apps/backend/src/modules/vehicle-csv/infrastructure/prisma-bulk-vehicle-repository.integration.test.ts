import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../auth/infrastructure/prisma-client.js';
import { PrismaBulkVehicleRepository } from './prisma-bulk-vehicle-repository.js';

const testDatabaseConfigured = process.env['TEST_DATABASE_URL'] !== undefined;
const actorId = randomUUID();
const category = `csv-${randomUUID()}`;
let prisma: ReturnType<typeof createPrismaClient> | undefined;

function databaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];
  if (value === undefined) {
    throw new Error('TEST_DATABASE_URL is required.');
  }
  const name = decodeURIComponent(new URL(value).pathname.slice(1)).toLowerCase();
  if (!/(?:^|[_-])test(?:$|[_-])/u.test(name)) {
    throw new Error('TEST_DATABASE_URL must identify a dedicated test database.');
  }
  return value;
}

function client(): NonNullable<typeof prisma> {
  if (prisma === undefined) {
    throw new Error('Test database is not connected.');
  }
  return prisma;
}

describe.runIf(testDatabaseConfigured)('transactional CSV vehicle import', () => {
  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl());
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: actorId,
        name: 'CSV Import Administrator',
        email: `${actorId}@example.invalid`,
        passwordHash: 'not-a-real-password-hash',
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.inventoryActivity.deleteMany({ where: { performedById: actorId } });
    await prisma.vehicle.deleteMany({ where: { category: { startsWith: category } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it('creates every vehicle and CSV activity in one transaction', async () => {
    const repository = new PrismaBulkVehicleRepository(client());
    await expect(
      repository.importWithActivities(
        [
          { make: 'Toyota', model: 'Fortuner', category, price: '3500000.25', quantity: 5 },
          { make: 'Honda', model: 'City', category, price: '1500000.00', quantity: 2 },
        ],
        actorId,
      ),
    ).resolves.toBe(2);

    await expect(client().vehicle.count({ where: { category } })).resolves.toBe(2);
    const activities = await client().inventoryActivity.findMany({
      where: { performedById: actorId, vehicleCategory: category },
    });
    expect(activities).toHaveLength(2);
    expect(
      activities.every(({ metadata }) => JSON.stringify(metadata).includes('CSV_IMPORT')),
    ).toBe(true);
  });

  it('rolls back the complete batch when an activity cannot be created', async () => {
    const rollbackCategory = `${category}-rollback`;
    const repository = new PrismaBulkVehicleRepository(client());

    await expect(
      repository.importWithActivities(
        [
          {
            make: 'Rollback',
            model: 'One',
            category: rollbackCategory,
            price: '100.00',
            quantity: 1,
          },
          {
            make: 'Rollback',
            model: 'Two',
            category: rollbackCategory,
            price: '200.00',
            quantity: 2,
          },
        ],
        randomUUID(),
      ),
    ).rejects.toThrow();
    await expect(client().vehicle.count({ where: { category: rollbackCategory } })).resolves.toBe(
      0,
    );
  });
});
