import {
  type Prisma,
  type PrismaClient,
  type Vehicle as PrismaVehicle,
} from '../../../generated/prisma/client.js';
import type {
  AtomicPurchaseResult,
  CreateVehicleData,
  FindVehiclesQuery,
  UpdateVehicleData,
  VehicleFilters,
  VehicleRepository,
  VehicleSort,
} from '../domain/vehicle-repository.js';
import type { PersistedVehicle } from '../domain/vehicle-types.js';

export interface PrismaVehicleDelegate {
  create(input: { data: Prisma.VehicleCreateInput }): Promise<PrismaVehicle>;
  findMany(input: {
    where: Prisma.VehicleWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.VehicleOrderByWithRelationInput[];
  }): Promise<PrismaVehicle[]>;
  count(input: { where: Prisma.VehicleWhereInput }): Promise<number>;
  findUnique(input: { where: { id: string } }): Promise<PrismaVehicle | null>;
  updateManyAndReturn(input: {
    where: { id: string; quantity: { gte: number } };
    data: { quantity: { decrement: number } };
  }): Promise<PrismaVehicle[]>;
  update(input: { where: { id: string }; data: Prisma.VehicleUpdateInput }): Promise<PrismaVehicle>;
  delete(input: { where: { id: string } }): Promise<PrismaVehicle>;
}

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

function activitySnapshot(vehicle: PrismaVehicle) {
  return {
    vehicleMake: vehicle.make,
    vehicleModel: vehicle.model,
    vehicleCategory: vehicle.category,
  };
}

function toPersistedVehicle(vehicle: PrismaVehicle): PersistedVehicle {
  return {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    category: vehicle.category,
    price: vehicle.price.toFixed(2),
    quantity: vehicle.quantity,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

function toWhere(filters: VehicleFilters): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {};

  if (filters.make !== undefined) {
    where.make = { contains: filters.make, mode: 'insensitive' };
  }

  if (filters.model !== undefined) {
    where.model = { contains: filters.model, mode: 'insensitive' };
  }

  if (filters.category !== undefined) {
    where.category = { contains: filters.category, mode: 'insensitive' };
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {
      ...(filters.minPrice === undefined ? {} : { gte: filters.minPrice }),
      ...(filters.maxPrice === undefined ? {} : { lte: filters.maxPrice }),
    };
  }

  if (filters.inStock !== undefined) {
    where.quantity = filters.inStock ? { gt: 0 } : { equals: 0 };
  }

  if (filters.maxQuantity !== undefined) {
    where.quantity = { lte: filters.maxQuantity };
  }

  return where;
}

function toPrimaryOrder(sort: VehicleSort): Prisma.VehicleOrderByWithRelationInput {
  switch (sort.field) {
    case 'make':
      return { make: sort.order };
    case 'model':
      return { model: sort.order };
    case 'category':
      return { category: sort.order };
    case 'price':
      return { price: sort.order };
    case 'quantity':
      return { quantity: sort.order };
    case 'createdAt':
      return { createdAt: sort.order };
  }
}

function isRecordNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

export class PrismaVehicleRepository implements VehicleRepository {
  private readonly transactionClient: PrismaClient | undefined;
  private readonly vehicles: PrismaVehicleDelegate;

  public constructor(client: PrismaClient | PrismaVehicleDelegate) {
    if ('$transaction' in client) {
      this.transactionClient = client;
      this.vehicles = client.vehicle;
    } else {
      this.transactionClient = undefined;
      this.vehicles = client;
    }
  }

  private transaction<T>(operation: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    if (this.transactionClient === undefined) {
      throw new Error('Transactional vehicle operations require a Prisma client.');
    }

    return this.transactionClient.$transaction(operation);
  }

  public async create(input: CreateVehicleData): Promise<PersistedVehicle> {
    const vehicle = await this.vehicles.create({ data: input });

    return toPersistedVehicle(vehicle);
  }

  public async createWithActivity(
    input: CreateVehicleData,
    performedById: string,
  ): Promise<PersistedVehicle> {
    const vehicle = await this.transaction(async (transaction) => {
      const created = await transaction.vehicle.create({ data: input });
      await transaction.inventoryActivity.create({
        data: {
          action: 'VEHICLE_CREATED',
          vehicle: { connect: { id: created.id } },
          ...activitySnapshot(created),
          quantityBefore: null,
          quantityChange: created.quantity,
          quantityAfter: created.quantity,
          performedBy: { connect: { id: performedById } },
        },
      });
      return created;
    });

    return toPersistedVehicle(vehicle);
  }

  public async findMany(query: FindVehiclesQuery): Promise<PersistedVehicle[]> {
    const vehicles = await this.vehicles.findMany({
      where: toWhere(query.filters),
      skip: query.pagination.skip,
      take: query.pagination.take,
      orderBy: [
        toPrimaryOrder(query.sort),
        ...(query.secondarySort === undefined ? [] : [toPrimaryOrder(query.secondarySort)]),
        { id: 'asc' },
      ],
    });

    return vehicles.map(toPersistedVehicle);
  }

  public count(filters: VehicleFilters): Promise<number> {
    return this.vehicles.count({ where: toWhere(filters) });
  }

  public async findById(id: string): Promise<PersistedVehicle | null> {
    const vehicle = await this.vehicles.findUnique({ where: { id } });

    return vehicle === null ? null : toPersistedVehicle(vehicle);
  }

  public async update(id: string, input: UpdateVehicleData): Promise<PersistedVehicle | null> {
    try {
      const vehicle = await this.vehicles.update({ where: { id }, data: input });

      return toPersistedVehicle(vehicle);
    } catch (error: unknown) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async updateWithActivity(
    id: string,
    input: UpdateVehicleData,
    performedById: string,
  ): Promise<PersistedVehicle | null> {
    try {
      const vehicle = await this.transaction(async (transaction) => {
        const previous = await transaction.vehicle.findUnique({ where: { id } });

        if (previous === null) {
          return null;
        }

        const updated = await transaction.vehicle.update({ where: { id }, data: input });
        const changedFields = Object.keys(input);
        await transaction.inventoryActivity.create({
          data: {
            action: 'VEHICLE_UPDATED',
            vehicle: { connect: { id: updated.id } },
            ...activitySnapshot(updated),
            quantityBefore: previous.quantity,
            quantityChange: updated.quantity - previous.quantity,
            quantityAfter: updated.quantity,
            performedBy: { connect: { id: performedById } },
            metadata: {
              changedFields,
              previous: {
                make: previous.make,
                model: previous.model,
                category: previous.category,
                price: previous.price.toFixed(2),
                quantity: previous.quantity,
              },
              updated: {
                make: updated.make,
                model: updated.model,
                category: updated.category,
                price: updated.price.toFixed(2),
                quantity: updated.quantity,
              },
            },
          },
        });
        return updated;
      });

      return vehicle === null ? null : toPersistedVehicle(vehicle);
    } catch (error: unknown) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async purchaseAtomic(id: string, quantity: number): Promise<AtomicPurchaseResult> {
    const updatedVehicles = await this.vehicles.updateManyAndReturn({
      where: { id, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    const updatedVehicle = updatedVehicles[0];

    if (updatedVehicle !== undefined) {
      return { outcome: 'updated', vehicle: toPersistedVehicle(updatedVehicle) };
    }

    const existingVehicle = await this.vehicles.findUnique({ where: { id } });

    return existingVehicle === null ? { outcome: 'notFound' } : { outcome: 'insufficientStock' };
  }

  public purchaseWithActivity(
    id: string,
    quantity: number,
    performedById: string,
  ): Promise<AtomicPurchaseResult> {
    return this.transaction(async (transaction) => {
      const updatedVehicles = await transaction.vehicle.updateManyAndReturn({
        where: { id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      const updated = updatedVehicles[0];

      if (updated === undefined) {
        const existing = await transaction.vehicle.findUnique({ where: { id } });
        return existing === null
          ? { outcome: 'notFound' as const }
          : { outcome: 'insufficientStock' as const };
      }

      await transaction.purchase.create({
        data: {
          user: { connect: { id: performedById } },
          vehicle: { connect: { id: updated.id } },
          ...activitySnapshot(updated),
          unitPrice: updated.price,
          quantity,
          totalAmount: updated.price.mul(quantity),
        },
      });
      await transaction.inventoryActivity.create({
        data: {
          action: 'VEHICLE_PURCHASED',
          vehicle: { connect: { id: updated.id } },
          ...activitySnapshot(updated),
          quantityBefore: updated.quantity + quantity,
          quantityChange: -quantity,
          quantityAfter: updated.quantity,
          performedBy: { connect: { id: performedById } },
        },
      });

      return { outcome: 'updated' as const, vehicle: toPersistedVehicle(updated) };
    });
  }

  public async restockAtomic(id: string, quantity: number): Promise<PersistedVehicle | null> {
    try {
      const vehicle = await this.vehicles.update({
        where: { id },
        data: { quantity: { increment: quantity } },
      });

      return toPersistedVehicle(vehicle);
    } catch (error: unknown) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async restockWithActivity(
    id: string,
    quantity: number,
    performedById: string,
  ): Promise<PersistedVehicle | null> {
    try {
      const updated = await this.transaction(async (transaction) => {
        const vehicle = await transaction.vehicle.update({
          where: { id },
          data: { quantity: { increment: quantity } },
        });
        await transaction.inventoryActivity.create({
          data: {
            action: 'VEHICLE_RESTOCKED',
            vehicle: { connect: { id: vehicle.id } },
            ...activitySnapshot(vehicle),
            quantityBefore: vehicle.quantity - quantity,
            quantityChange: quantity,
            quantityAfter: vehicle.quantity,
            performedBy: { connect: { id: performedById } },
          },
        });
        return vehicle;
      });

      return toPersistedVehicle(updated);
    } catch (error: unknown) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await this.vehicles.delete({ where: { id } });

      return true;
    } catch (error: unknown) {
      if (isRecordNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }

  public async deleteWithActivity(id: string, performedById: string): Promise<boolean> {
    try {
      return await this.transaction(async (transaction) => {
        const vehicle = await transaction.vehicle.findUnique({ where: { id } });

        if (vehicle === null) {
          return false;
        }

        await transaction.inventoryActivity.create({
          data: {
            action: 'VEHICLE_DELETED',
            vehicle: { connect: { id: vehicle.id } },
            ...activitySnapshot(vehicle),
            quantityBefore: vehicle.quantity,
            quantityChange: -vehicle.quantity,
            quantityAfter: 0,
            performedBy: { connect: { id: performedById } },
          },
        });
        await transaction.vehicle.delete({ where: { id } });
        return true;
      });
    } catch (error: unknown) {
      if (isRecordNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }
}
