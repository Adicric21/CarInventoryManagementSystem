import type {
  InventoryActivityAction,
  PersistedInventoryActivity,
} from './inventory-activity-types.js';

export interface InventoryActivityFilters {
  action?: InventoryActivityAction;
  vehicleId?: string;
  performedById?: string;
  from?: Date;
  to?: Date;
}

export interface FindInventoryActivitiesQuery {
  filters: InventoryActivityFilters;
  pagination: {
    skip: number;
    take: number;
  };
  sortOrder: 'asc' | 'desc';
}

export interface InventoryActivityRepository {
  findMany(query: FindInventoryActivitiesQuery): Promise<PersistedInventoryActivity[]>;
  count(filters: InventoryActivityFilters): Promise<number>;
}

export interface InventoryActivityDependencies {
  inventoryActivityRepository: InventoryActivityRepository;
}
