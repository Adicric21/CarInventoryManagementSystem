import type { PersistedVehicle, SortOrder, VehicleSortField } from './vehicle-types.js';

export interface CreateVehicleData {
  make: string;
  model: string;
  category: string;
  price: string;
  quantity: number;
}

export type UpdateVehicleData = Partial<CreateVehicleData>;

export type AtomicPurchaseResult =
  | { outcome: 'updated'; vehicle: PersistedVehicle }
  | { outcome: 'notFound' }
  | { outcome: 'insufficientStock' };

export interface VehicleFilters {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
  maxQuantity?: number;
}

export interface VehicleSort {
  field: VehicleSortField;
  order: SortOrder;
}

export interface FindVehiclesQuery {
  filters: VehicleFilters;
  pagination: {
    skip: number;
    take: number;
  };
  sort: VehicleSort;
  secondarySort?: VehicleSort;
}

export interface VehicleRepository {
  create(input: CreateVehicleData): Promise<PersistedVehicle>;
  createWithActivity(input: CreateVehicleData, performedById: string): Promise<PersistedVehicle>;
  findMany(query: FindVehiclesQuery): Promise<PersistedVehicle[]>;
  count(filters: VehicleFilters): Promise<number>;
  findById(id: string): Promise<PersistedVehicle | null>;
  update(id: string, input: UpdateVehicleData): Promise<PersistedVehicle | null>;
  updateWithActivity(
    id: string,
    input: UpdateVehicleData,
    performedById: string,
  ): Promise<PersistedVehicle | null>;
  delete(id: string): Promise<boolean>;
  deleteWithActivity(id: string, performedById: string): Promise<boolean>;
  purchaseAtomic(id: string, quantity: number): Promise<AtomicPurchaseResult>;
  purchaseWithActivity(
    id: string,
    quantity: number,
    performedById: string,
  ): Promise<AtomicPurchaseResult>;
  restockAtomic(id: string, quantity: number): Promise<PersistedVehicle | null>;
  restockWithActivity(
    id: string,
    quantity: number,
    performedById: string,
  ): Promise<PersistedVehicle | null>;
}

export interface VehicleDependencies {
  vehicleRepository: VehicleRepository;
  lowStockThreshold: number;
}
