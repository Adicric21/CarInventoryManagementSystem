import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../auth/infrastructure/prisma-client.js';
import { PrismaVehicleRepository } from '../../vehicles/infrastructure/prisma-vehicle-repository.js';

const testDatabaseConfigured = process.env['TEST_DATABASE_URL'] !== undefined;
const actorId = randomUUID();
const testCategory = `activity-${randomUUID()}`;

let prisma: ReturnType<typeof createPrismaClient> | undefined;
let repository: PrismaVehicleRepository | undefined;

function testDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];
  if (value === undefined) {
    throw new Error('TEST_DATABASE_URL is required.');
  }
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
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

function vehicleRepository(): PrismaVehicleRepository {
  if (repository === undefined) {
    throw new Error('Vehicle repository is not initialized.');
  }
  return repository;
}

describe.runIf(testDatabaseConfigured)('transactional inventory activity auditing', () => {
  beforeAll(async () => {
    prisma = createPrismaClient(testDatabaseUrl());
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: actorId,
        name: 'Activity Test Actor',
        email: `${actorId}@example.invalid`,
        passwordHash: 'not-a-real-password-hash',
        role: 'ADMIN',
      },
    });
    repository = new PrismaVehicleRepository(prisma);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.inventoryActivity.deleteMany({ where: { performedById: actorId } });
    await prisma.purchase.deleteMany({ where: { userId: actorId } });
    await prisma.vehicle.deleteMany({ where: { category: testCategory } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it('records create, update, restock, purchase, and delete snapshots in their transactions', async () => {
    const created = await vehicleRepository().createWithActivity(
      {
        make: 'Toyota',
        model: 'Fortuner',
        category: testCategory,
        price: '3500000.00',
        quantity: 5,
      },
      actorId,
    );
    await vehicleRepository().updateWithActivity(created.id, { model: 'Legender' }, actorId);
    await vehicleRepository().restockWithActivity(created.id, 2, actorId);
    await vehicleRepository().purchaseWithActivity(created.id, 3, actorId);
    await vehicleRepository().deleteWithActivity(created.id, actorId);

    const activities = await client().inventoryActivity.findMany({
      where: { performedById: actorId },
      orderBy: { createdAt: 'asc' },
    });

    expect(activities.map(({ action }) => action)).toEqual([
      'VEHICLE_CREATED',
      'VEHICLE_UPDATED',
      'VEHICLE_RESTOCKED',
      'VEHICLE_PURCHASED',
      'VEHICLE_DELETED',
    ]);
    expect(activities.at(-1)).toMatchObject({
      vehicleId: null,
      vehicleMake: 'Toyota',
      vehicleModel: 'Legender',
      vehicleCategory: testCategory,
      quantityBefore: 4,
      quantityChange: -4,
      quantityAfter: 0,
    });
    const purchase = await client().purchase.findFirstOrThrow({ where: { userId: actorId } });
    expect(purchase).toMatchObject({
      vehicleId: null,
      vehicleMake: 'Toyota',
      vehicleModel: 'Legender',
      vehicleCategory: testCategory,
      quantity: 3,
    });
    expect(purchase.unitPrice.toFixed(2)).toBe('3500000.00');
    expect(purchase.totalAmount.toFixed(2)).toBe('10500000.00');
  });

  it('rolls back vehicle creation when its activity cannot be persisted', async () => {
    const category = `${testCategory}-rollback`;

    await expect(
      vehicleRepository().createWithActivity(
        {
          make: 'Rollback',
          model: 'Audit failure',
          category,
          price: '100.00',
          quantity: 1,
        },
        randomUUID(),
      ),
    ).rejects.toThrow();

    await expect(client().vehicle.count({ where: { category } })).resolves.toBe(0);
  });

  it('rolls back a stock decrement when its purchase activity cannot be persisted', async () => {
    const vehicle = await client().vehicle.create({
      data: {
        make: 'Rollback',
        model: 'Purchase audit failure',
        category: testCategory,
        price: '100.00',
        quantity: 2,
      },
    });

    await expect(
      vehicleRepository().purchaseWithActivity(vehicle.id, 1, randomUUID()),
    ).rejects.toThrow();

    const persisted = await client().vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(persisted.quantity).toBe(2);
    await expect(
      client().inventoryActivity.count({ where: { vehicleId: vehicle.id } }),
    ).resolves.toBe(0);
    await expect(client().purchase.count({ where: { vehicleId: vehicle.id } })).resolves.toBe(0);
  });
});
