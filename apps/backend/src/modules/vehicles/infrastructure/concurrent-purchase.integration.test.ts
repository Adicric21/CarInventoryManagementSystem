import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../auth/infrastructure/prisma-client.js';
import type {
  AtomicPurchaseResult,
  CreateVehicleData,
  FindVehiclesQuery,
  UpdateVehicleData,
  VehicleFilters,
  VehicleRepository,
} from '../domain/vehicle-repository.js';
import type { PersistedVehicle } from '../domain/vehicle-types.js';
import { createConcurrentPurchaseHttpSubject } from '../test-support/concurrent-purchase-http-subject.js';
import { PrismaVehicleRepository } from './prisma-vehicle-repository.js';

const testDatabaseConfigured = process.env['TEST_DATABASE_URL'] !== undefined;
const testMarker = `concurrent-purchase-${randomUUID()}`;
const purchaseUserId = randomUUID();

let prisma: ReturnType<typeof createPrismaClient> | undefined;
let app: Express | undefined;
let databaseConnected = false;

function loadTestDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];

  if (value === undefined) {
    throw new Error('TEST_DATABASE_URL is required for the concurrent purchase integration test.');
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

function getPrisma(): NonNullable<typeof prisma> {
  if (prisma === undefined) {
    throw new Error('The concurrent purchase test database is not connected.');
  }

  return prisma;
}

function getApp(): Express {
  if (app === undefined) {
    throw new Error('The concurrent purchase HTTP subject is not initialized.');
  }

  return app;
}

class SynchronizedPurchaseRepository implements VehicleRepository {
  private purchaseArrivals = 0;
  private releasePurchases: () => void = () => undefined;
  private readonly bothPurchasesReady = new Promise<void>((resolve) => {
    this.releasePurchases = resolve;
  });

  constructor(private readonly repository: VehicleRepository) {}

  create(input: CreateVehicleData): Promise<PersistedVehicle> {
    return this.repository.create(input);
  }

  createWithActivity(input: CreateVehicleData, performedById: string): Promise<PersistedVehicle> {
    return this.repository.createWithActivity(input, performedById);
  }

  findMany(query: FindVehiclesQuery): Promise<PersistedVehicle[]> {
    return this.repository.findMany(query);
  }

  count(filters: VehicleFilters): Promise<number> {
    return this.repository.count(filters);
  }

  findById(id: string): Promise<PersistedVehicle | null> {
    return this.repository.findById(id);
  }

  update(id: string, input: UpdateVehicleData): Promise<PersistedVehicle | null> {
    return this.repository.update(id, input);
  }

  updateWithActivity(
    id: string,
    input: UpdateVehicleData,
    performedById: string,
  ): Promise<PersistedVehicle | null> {
    return this.repository.updateWithActivity(id, input, performedById);
  }

  delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  deleteWithActivity(id: string, performedById: string): Promise<boolean> {
    return this.repository.deleteWithActivity(id, performedById);
  }

  async purchaseAtomic(id: string, quantity: number): Promise<AtomicPurchaseResult> {
    this.purchaseArrivals += 1;

    if (this.purchaseArrivals === 2) {
      this.releasePurchases();
    }

    await this.bothPurchasesReady;
    return this.repository.purchaseAtomic(id, quantity);
  }

  async purchaseWithActivity(
    id: string,
    quantity: number,
    performedById: string,
  ): Promise<AtomicPurchaseResult> {
    this.purchaseArrivals += 1;

    if (this.purchaseArrivals === 2) {
      this.releasePurchases();
    }

    await this.bothPurchasesReady;
    return this.repository.purchaseWithActivity(id, quantity, performedById);
  }

  restockAtomic(id: string, quantity: number): Promise<PersistedVehicle | null> {
    return this.repository.restockAtomic(id, quantity);
  }

  restockWithActivity(
    id: string,
    quantity: number,
    performedById: string,
  ): Promise<PersistedVehicle | null> {
    return this.repository.restockWithActivity(id, quantity, performedById);
  }
}

describe.runIf(testDatabaseConfigured)('concurrent vehicle purchase with PostgreSQL', () => {
  beforeAll(async () => {
    prisma = createPrismaClient(loadTestDatabaseUrl());
    await prisma.$connect();
    databaseConnected = true;
    await prisma.user.upsert({
      where: { id: purchaseUserId },
      update: {},
      create: {
        id: purchaseUserId,
        name: 'Concurrent Purchase User',
        email: `concurrent-${randomUUID()}@example.invalid`,
        passwordHash: 'not-a-real-password-hash',
        role: 'USER',
      },
    });
    const vehicleRepository = new PrismaVehicleRepository(prisma);
    app = createConcurrentPurchaseHttpSubject(
      {
        vehicleRepository: new SynchronizedPurchaseRepository(vehicleRepository),
        lowStockThreshold: 3,
      },
      purchaseUserId,
    );
  });

  afterEach(async () => {
    if (databaseConnected) {
      await getPrisma().purchase.deleteMany({ where: { userId: purchaseUserId } });
      await getPrisma().vehicle.deleteMany({ where: { category: testMarker } });
    }
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }

    try {
      if (databaseConnected) {
        await prisma.inventoryActivity.deleteMany({ where: { performedById: purchaseUserId } });
        await prisma.purchase.deleteMany({ where: { userId: purchaseUserId } });
        await prisma.vehicle.deleteMany({ where: { category: testMarker } });
        await prisma.user.deleteMany({ where: { id: purchaseUserId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('allows exactly one of two concurrent purchases when only one vehicle is in stock', async () => {
    const vehicle = await getPrisma().vehicle.create({
      data: {
        make: 'Concurrency',
        model: 'Single-stock vehicle',
        category: testMarker,
        price: '100.00',
        quantity: 1,
      },
    });

    const purchase = () =>
      request(getApp())
        .post(`/api/vehicles/${vehicle.id}/purchase`)
        .set('Authorization', 'Bearer purchase-user-token')
        .send({ quantity: 1 });

    const responses = await Promise.all([purchase(), purchase()]);
    const statuses = responses.map(({ status }) => status);
    const persistedVehicle = await getPrisma().vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    const successfulResponse = responses.find(({ status }) => status === 200);

    expect.soft(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect.soft(statuses.filter((status) => status === 409)).toHaveLength(1);
    expect.soft(statuses).not.toContain(500);
    expect.soft(persistedVehicle.quantity).toBe(0);
    expect.soft(persistedVehicle.quantity).toBeGreaterThanOrEqual(0);
    await expect(
      getPrisma().inventoryActivity.count({
        where: { vehicleId: vehicle.id, action: 'VEHICLE_PURCHASED' },
      }),
    ).resolves.toBe(1);
    await expect(
      getPrisma().purchase.count({ where: { vehicleId: vehicle.id, userId: purchaseUserId } }),
    ).resolves.toBe(1);
    expect(successfulResponse?.body).toMatchObject({
      data: { id: vehicle.id, quantity: 0 },
    });
  });
});
