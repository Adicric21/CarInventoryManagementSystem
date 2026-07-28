import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../auth/infrastructure/prisma-client.js';
import type { CreateVehicleData } from '../domain/vehicle-repository.js';
import { PrismaVehicleRepository } from './prisma-vehicle-repository.js';

const testDatabaseConfigured = process.env['TEST_DATABASE_URL'] !== undefined;
const testCategory = `integration-${randomUUID()}`;

let prisma: ReturnType<typeof createPrismaClient> | undefined;
let repository: PrismaVehicleRepository | undefined;
let databaseConnected = false;

function loadTestDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];

  if (value === undefined) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  const isPostgres = url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  const isClearlyTestDatabase = /(?:^|[_-])test(?:$|[_-])/u.test(databaseName);

  if (!isPostgres || !isClearlyTestDatabase) {
    throw new Error('TEST_DATABASE_URL must identify a dedicated PostgreSQL test database.');
  }

  return value;
}

function getPrisma() {
  if (prisma === undefined) {
    throw new Error('The test database client is not connected.');
  }

  return prisma;
}

function getRepository(): PrismaVehicleRepository {
  if (repository === undefined) {
    throw new Error('The vehicle repository is not initialized.');
  }

  return repository;
}

function vehicleData(overrides: Partial<CreateVehicleData> = {}): CreateVehicleData {
  return {
    make: 'Toyota',
    model: 'Fortuner',
    category: testCategory,
    price: '3500000.25',
    quantity: 5,
    ...overrides,
  };
}

describe.runIf(testDatabaseConfigured)('Prisma vehicle repository with PostgreSQL', () => {
  beforeAll(async () => {
    prisma = createPrismaClient(loadTestDatabaseUrl());
    await prisma.$connect();
    databaseConnected = true;
    repository = new PrismaVehicleRepository(prisma);
  });

  afterEach(async () => {
    if (databaseConnected) {
      await getPrisma().vehicle.deleteMany({ where: { category: testCategory } });
    }
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }

    try {
      if (databaseConnected) {
        await prisma.vehicle.deleteMany({ where: { category: testCategory } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('persists generated fields and exact decimal values', async () => {
    const created = await getRepository().create(vehicleData());
    const persisted = await getPrisma().vehicle.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(created.price).toBe('3500000.25');
    expect(persisted.price.toString()).toBe('3500000.25');
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it('filters, counts, paginates, and sorts inside PostgreSQL', async () => {
    await Promise.all([
      getRepository().create(vehicleData({ price: '100.00' })),
      getRepository().create(vehicleData({ model: 'Camry', price: '10.00', quantity: 2 })),
      getRepository().create(
        vehicleData({ make: 'Honda', model: 'City', price: '2.00', quantity: 1 }),
      ),
    ]);

    const matching = await getRepository().findMany({
      filters: {
        make: 'tOyOtA',
        category: testCategory.toUpperCase(),
        minPrice: '5.00',
        maxPrice: '50.00',
        inStock: true,
      },
      pagination: { skip: 0, take: 10 },
      sort: { field: 'price', order: 'asc' },
    });
    const secondInStockVehicle = await getRepository().findMany({
      filters: { category: testCategory.toUpperCase(), inStock: true },
      pagination: { skip: 1, take: 1 },
      sort: { field: 'price', order: 'asc' },
    });
    const total = await getRepository().count({
      category: testCategory.toUpperCase(),
      inStock: true,
    });

    expect(matching.map(({ model }) => model)).toEqual(['Camry']);
    expect(secondInStockVehicle.map(({ model }) => model)).toEqual(['Camry']);
    expect(total).toBe(3);
  });

  it('filters and orders low-stock vehicles inside PostgreSQL', async () => {
    await Promise.all([
      getRepository().create(vehicleData({ make: 'Zulu', quantity: 3 })),
      getRepository().create(vehicleData({ make: 'Alpha', quantity: 0 })),
      getRepository().create(vehicleData({ make: 'Excluded', quantity: 4 })),
    ]);

    const vehicles = await getRepository().findMany({
      filters: { category: testCategory, maxQuantity: 3 },
      pagination: { skip: 0, take: 20 },
      sort: { field: 'quantity', order: 'asc' },
      secondarySort: { field: 'make', order: 'asc' },
    });
    const total = await getRepository().count({
      category: testCategory,
      maxQuantity: 3,
    });

    expect(vehicles.map(({ make, quantity }) => ({ make, quantity }))).toEqual([
      { make: 'Alpha', quantity: 0 },
      { make: 'Zulu', quantity: 3 },
    ]);
    expect(total).toBe(2);
  });

  it('updates and permanently deletes an existing vehicle', async () => {
    const created = await getRepository().create(vehicleData());

    const updated = await getRepository().update(created.id, {
      price: '3600000.50',
      quantity: 3,
    });
    const persistedUpdate = await getRepository().findById(created.id);

    expect(updated).toMatchObject({ price: '3600000.50', quantity: 3 });
    expect(persistedUpdate).toMatchObject({ price: '3600000.50', quantity: 3 });
    await expect(getRepository().delete(created.id)).resolves.toBe(true);
    await expect(getRepository().findById(created.id)).resolves.toBeNull();
    await expect(getRepository().delete(created.id)).resolves.toBe(false);
  });

  it('enforces the migrated price and quantity constraints', async () => {
    await expect(
      getPrisma().vehicle.create({
        data: vehicleData({ price: '0.00' }),
      }),
    ).rejects.toThrow();
    await expect(
      getPrisma().vehicle.create({
        data: vehicleData({ quantity: -1 }),
      }),
    ).rejects.toThrow();
    await expect(getPrisma().vehicle.count({ where: { category: testCategory } })).resolves.toBe(0);
  });
});
