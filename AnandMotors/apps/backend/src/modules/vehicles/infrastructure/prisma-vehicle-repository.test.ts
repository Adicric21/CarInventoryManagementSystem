import { describe, expect, it, vi } from 'vitest';

import { Prisma, type Vehicle as PrismaVehicle } from '../../../generated/prisma/client.js';
import type { CreateVehicleData } from '../domain/vehicle-repository.js';
import {
  type PrismaVehicleDelegate,
  PrismaVehicleRepository,
} from './prisma-vehicle-repository.js';

const VEHICLE_ID = '2a4c472f-07bf-4d65-98ca-5641d09c4e27';

function createPrismaVehicle(overrides: Partial<PrismaVehicle> = {}): PrismaVehicle {
  return {
    id: VEHICLE_ID,
    make: 'Toyota',
    model: 'Fortuner',
    category: 'SUV',
    price: new Prisma.Decimal('3500000.00'),
    quantity: 5,
    createdAt: new Date('2026-07-20T09:30:00.000Z'),
    updatedAt: new Date('2026-07-21T11:45:00.000Z'),
    ...overrides,
  };
}

function createDelegate() {
  const create = vi.fn<PrismaVehicleDelegate['create']>(() =>
    Promise.resolve(createPrismaVehicle()),
  );
  const findMany = vi.fn<PrismaVehicleDelegate['findMany']>(() => Promise.resolve([]));
  const count = vi.fn<PrismaVehicleDelegate['count']>(() => Promise.resolve(0));
  const findUnique = vi.fn<PrismaVehicleDelegate['findUnique']>(() => Promise.resolve(null));
  const update = vi.fn<PrismaVehicleDelegate['update']>(() =>
    Promise.resolve(createPrismaVehicle()),
  );
  const deleteVehicle = vi.fn<PrismaVehicleDelegate['delete']>(() =>
    Promise.resolve(createPrismaVehicle()),
  );
  const updateManyAndReturn = vi.fn<PrismaVehicleDelegate['updateManyAndReturn']>(() =>
    Promise.resolve([createPrismaVehicle({ quantity: 4 })]),
  );

  return {
    create,
    findMany,
    count,
    findUnique,
    updateManyAndReturn,
    update,
    delete: deleteVehicle,
  } satisfies PrismaVehicleDelegate;
}

const CREATE_INPUT: CreateVehicleData = {
  make: 'Toyota',
  model: 'Fortuner',
  category: 'SUV',
  price: '3500000.00',
  quantity: 5,
};

describe('Prisma vehicle repository', () => {
  it('creates a vehicle using a decimal string and maps the persisted result', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.create(CREATE_INPUT)).resolves.toEqual({
      id: VEHICLE_ID,
      ...CREATE_INPUT,
      createdAt: new Date('2026-07-20T09:30:00.000Z'),
      updatedAt: new Date('2026-07-21T11:45:00.000Z'),
    });
    expect(delegate.create).toHaveBeenCalledWith({ data: CREATE_INPUT });
  });

  it('builds safe database filters, pagination, and deterministic ordering', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await repository.findMany({
      filters: {
        make: 'ToYoTa',
        model: 'FoRtUnEr',
        category: 'SuV',
        minPrice: '3000000.25',
        maxPrice: '4000000.75',
        inStock: true,
      },
      pagination: { skip: 20, take: 10 },
      sort: { field: 'price', order: 'desc' },
    });

    expect(delegate.findMany).toHaveBeenCalledWith({
      where: {
        make: { contains: 'ToYoTa', mode: 'insensitive' },
        model: { contains: 'FoRtUnEr', mode: 'insensitive' },
        category: { contains: 'SuV', mode: 'insensitive' },
        price: { gte: '3000000.25', lte: '4000000.75' },
        quantity: { gt: 0 },
      },
      skip: 20,
      take: 10,
      orderBy: [{ price: 'desc' }, { id: 'asc' }],
    });
  });

  it('filters out-of-stock vehicles using a structured quantity predicate', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await repository.findMany({
      filters: { inStock: false },
      pagination: { skip: 0, take: 10 },
      sort: { field: 'createdAt', order: 'desc' },
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { quantity: { equals: 0 } } }),
    );
  });

  it('filters low stock and applies a deterministic secondary make ordering', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await repository.findMany({
      filters: { maxQuantity: 3 },
      pagination: { skip: 0, take: 20 },
      sort: { field: 'quantity', order: 'asc' },
      secondarySort: { field: 'make', order: 'asc' },
    });

    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { quantity: { lte: 3 } },
      skip: 0,
      take: 20,
      orderBy: [{ quantity: 'asc' }, { make: 'asc' }, { id: 'asc' }],
    });
  });

  it('counts with the same case-insensitive and decimal-safe filters', async () => {
    const delegate = createDelegate();
    delegate.count.mockResolvedValue(7);
    const repository = new PrismaVehicleRepository(delegate);

    await expect(
      repository.count({ make: 'Toyota', minPrice: '1000000.50', inStock: true }),
    ).resolves.toBe(7);
    expect(delegate.count).toHaveBeenCalledWith({
      where: {
        make: { contains: 'Toyota', mode: 'insensitive' },
        price: { gte: '1000000.50' },
        quantity: { gt: 0 },
      },
    });
  });

  it('finds and maps a vehicle by its server-generated id', async () => {
    const delegate = createDelegate();
    delegate.findUnique.mockResolvedValue(createPrismaVehicle());
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.findById(VEHICLE_ID)).resolves.toEqual({
      id: VEHICLE_ID,
      ...CREATE_INPUT,
      createdAt: new Date('2026-07-20T09:30:00.000Z'),
      updatedAt: new Date('2026-07-21T11:45:00.000Z'),
    });
    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: VEHICLE_ID } });
  });

  it('returns null when a vehicle does not exist', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.findById(VEHICLE_ID)).resolves.toBeNull();
  });

  it('updates only supplied editable fields', async () => {
    const delegate = createDelegate();
    delegate.update.mockResolvedValue(
      createPrismaVehicle({ price: new Prisma.Decimal('3750000.50'), quantity: 3 }),
    );
    const repository = new PrismaVehicleRepository(delegate);

    await expect(
      repository.update(VEHICLE_ID, { price: '3750000.50', quantity: 3 }),
    ).resolves.toMatchObject({ price: '3750000.50', quantity: 3 });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: VEHICLE_ID },
      data: { price: '3750000.50', quantity: 3 },
    });
  });

  it('maps a Prisma missing-record update to null', async () => {
    const delegate = createDelegate();
    delegate.update.mockRejectedValue({ code: 'P2025' });
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.update(VEHICLE_ID, { quantity: 3 })).resolves.toBeNull();
  });

  it('reports whether deletion removed a vehicle', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.delete(VEHICLE_ID)).resolves.toBe(true);
    expect(delegate.delete).toHaveBeenCalledWith({ where: { id: VEHICLE_ID } });
  });

  it('maps a Prisma missing-record deletion to false', async () => {
    const delegate = createDelegate();
    delegate.delete.mockRejectedValue({ code: 'P2025' });
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.delete(VEHICLE_ID)).resolves.toBe(false);
  });

  it.each(['update', 'delete'] as const)(
    'does not hide an unexpected %s persistence failure',
    async (operation) => {
      const delegate = createDelegate();
      const persistenceError = new Error('database unavailable');
      delegate[operation].mockRejectedValue(persistenceError);
      const repository = new PrismaVehicleRepository(delegate);

      const result =
        operation === 'update'
          ? repository.update(VEHICLE_ID, { quantity: 3 })
          : repository.delete(VEHICLE_ID);
      await expect(result).rejects.toBe(persistenceError);
    },
  );

  it('purchases stock with one conditional atomic decrement and returns the updated row', async () => {
    const delegate = createDelegate();
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.purchaseAtomic(VEHICLE_ID, 1)).resolves.toEqual({
      outcome: 'updated',
      vehicle: {
        id: VEHICLE_ID,
        ...CREATE_INPUT,
        quantity: 4,
        createdAt: new Date('2026-07-20T09:30:00.000Z'),
        updatedAt: new Date('2026-07-21T11:45:00.000Z'),
      },
    });
    expect(delegate.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: VEHICLE_ID, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    expect(delegate.findUnique).not.toHaveBeenCalled();
  });

  it('distinguishes a missing vehicle after a conditional purchase updates no row', async () => {
    const delegate = createDelegate();
    delegate.updateManyAndReturn.mockResolvedValue([]);
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.purchaseAtomic(VEHICLE_ID, 1)).resolves.toEqual({
      outcome: 'notFound',
    });
    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: VEHICLE_ID } });
  });

  it('distinguishes insufficient stock after a conditional purchase updates no row', async () => {
    const delegate = createDelegate();
    delegate.updateManyAndReturn.mockResolvedValue([]);
    delegate.findUnique.mockResolvedValue(createPrismaVehicle({ quantity: 0 }));
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.purchaseAtomic(VEHICLE_ID, 1)).resolves.toEqual({
      outcome: 'insufficientStock',
    });
  });

  it('restocks with an atomic increment and maps the updated row', async () => {
    const delegate = createDelegate();
    delegate.update.mockResolvedValue(createPrismaVehicle({ quantity: 10 }));
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.restockAtomic(VEHICLE_ID, 5)).resolves.toMatchObject({
      id: VEHICLE_ID,
      quantity: 10,
    });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: VEHICLE_ID },
      data: { quantity: { increment: 5 } },
    });
  });

  it('maps a missing-record atomic restock to null', async () => {
    const delegate = createDelegate();
    delegate.update.mockRejectedValue({ code: 'P2025' });
    const repository = new PrismaVehicleRepository(delegate);

    await expect(repository.restockAtomic(VEHICLE_ID, 5)).resolves.toBeNull();
  });
});
