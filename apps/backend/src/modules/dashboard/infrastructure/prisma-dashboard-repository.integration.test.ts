import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../auth/infrastructure/prisma-client.js';
import { PrismaDashboardRepository } from './prisma-dashboard-repository.js';

const testDatabaseConfigured = process.env['TEST_DATABASE_URL'] !== undefined;
const userId = randomUUID();
const category = `dashboard-${randomUUID()}`;
let prisma: ReturnType<typeof createPrismaClient> | undefined;

function testDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];
  if (value === undefined) {
    throw new Error('TEST_DATABASE_URL is required.');
  }
  const databaseName = decodeURIComponent(new URL(value).pathname.slice(1)).toLowerCase();
  if (!/(?:^|[_-])test(?:$|[_-])/u.test(databaseName)) {
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

describe.runIf(testDatabaseConfigured)('Prisma dashboard analytics', () => {
  beforeAll(async () => {
    prisma = createPrismaClient(testDatabaseUrl());
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Dashboard Test User',
        email: `${userId}@example.invalid`,
        passwordHash: 'not-a-real-password-hash',
        role: 'USER',
      },
    });
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.purchase.deleteMany({ where: { userId } });
    await prisma.vehicle.deleteMany({ where: { category } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('aggregates inventory, purchases, categories, days, and top vehicles', async () => {
    const vehicle = await client().vehicle.create({
      data: { make: 'Metric', model: 'One', category, price: '100.00', quantity: 2 },
    });
    await client().vehicle.create({
      data: { make: 'Metric', model: 'Empty', category, price: '50.00', quantity: 0 },
    });
    await client().purchase.create({
      data: {
        userId,
        vehicleId: vehicle.id,
        vehicleMake: 'Metric',
        vehicleModel: 'One',
        vehicleCategory: category,
        unitPrice: '100.00',
        quantity: 3,
        totalAmount: '300.00',
        purchasedAt: new Date('2099-01-02T12:00:00.000Z'),
      },
    });

    const result = await new PrismaDashboardRepository(client()).getDashboard({
      from: new Date('2099-01-01T00:00:00.000Z'),
      lowStockThreshold: 3,
    });

    expect(result.summary).toMatchObject({
      purchaseCount: 1,
      unitsPurchased: 3,
      purchaseRevenue: '300.00',
    });
    expect(result.vehiclesByCategory).toContainEqual({
      category,
      vehicleCount: 2,
      stockUnits: 2,
    });
    expect(result.topPurchasedVehicles).toContainEqual({
      vehicleMake: 'Metric',
      vehicleModel: 'One',
      unitsPurchased: 3,
      revenue: '300.00',
    });
    expect(result.purchasesByDay).toContainEqual(
      expect.objectContaining({ purchaseCount: 1, unitsPurchased: 3, revenue: '300.00' }),
    );
  });
});
