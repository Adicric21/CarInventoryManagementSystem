import {
  type InventoryActivity as PrismaInventoryActivity,
  type Prisma,
} from '../../../generated/prisma/client.js';
import type {
  FindInventoryActivitiesQuery,
  InventoryActivityFilters,
  InventoryActivityRepository,
} from '../domain/inventory-activity-repository.js';
import type { PersistedInventoryActivity } from '../domain/inventory-activity-types.js';

const performedBySelection = {
  id: true,
  name: true,
  email: true,
} as const;

type PrismaActivityWithActor = PrismaInventoryActivity & {
  performedBy: {
    id: string;
    name: string;
    email: string;
  };
};

export interface PrismaInventoryActivityDelegate {
  findMany(input: {
    where: Prisma.InventoryActivityWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.InventoryActivityOrderByWithRelationInput[];
    include: { performedBy: { select: typeof performedBySelection } };
  }): Promise<PrismaActivityWithActor[]>;
  count(input: { where: Prisma.InventoryActivityWhereInput }): Promise<number>;
}

function toWhere(filters: InventoryActivityFilters): Prisma.InventoryActivityWhereInput {
  return {
    ...(filters.action === undefined ? {} : { action: filters.action }),
    ...(filters.vehicleId === undefined ? {} : { vehicleId: filters.vehicleId }),
    ...(filters.performedById === undefined ? {} : { performedById: filters.performedById }),
    ...(filters.from === undefined && filters.to === undefined
      ? {}
      : {
          createdAt: {
            ...(filters.from === undefined ? {} : { gte: filters.from }),
            ...(filters.to === undefined ? {} : { lte: filters.to }),
          },
        }),
  };
}

function toPersistedActivity(activity: PrismaActivityWithActor): PersistedInventoryActivity {
  return {
    id: activity.id,
    action: activity.action,
    vehicleId: activity.vehicleId,
    vehicleMake: activity.vehicleMake,
    vehicleModel: activity.vehicleModel,
    vehicleCategory: activity.vehicleCategory,
    quantityBefore: activity.quantityBefore,
    quantityChange: activity.quantityChange,
    quantityAfter: activity.quantityAfter,
    performedBy: activity.performedBy,
    metadata: activity.metadata,
    createdAt: activity.createdAt,
  };
}

export class PrismaInventoryActivityRepository implements InventoryActivityRepository {
  public constructor(private readonly activities: PrismaInventoryActivityDelegate) {}

  public async findMany(
    query: FindInventoryActivitiesQuery,
  ): Promise<PersistedInventoryActivity[]> {
    const activities = await this.activities.findMany({
      where: toWhere(query.filters),
      skip: query.pagination.skip,
      take: query.pagination.take,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      include: { performedBy: { select: performedBySelection } },
    });

    return activities.map(toPersistedActivity);
  }

  public count(filters: InventoryActivityFilters): Promise<number> {
    return this.activities.count({ where: toWhere(filters) });
  }
}
