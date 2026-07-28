import type { PersistedPurchase } from './purchase-types.js';

export interface PurchaseFilters {
  userId?: string;
  vehicleId?: string;
  make?: string;
  model?: string;
  from?: Date;
  to?: Date;
}

export interface FindPurchasesQuery {
  filters: PurchaseFilters;
  pagination: { skip: number; take: number };
  sortOrder: 'asc' | 'desc';
}

export interface PurchaseRepository {
  findMany(query: FindPurchasesQuery): Promise<PersistedPurchase[]>;
  count(filters: PurchaseFilters): Promise<number>;
}

export interface PurchaseDependencies {
  purchaseRepository: PurchaseRepository;
}
