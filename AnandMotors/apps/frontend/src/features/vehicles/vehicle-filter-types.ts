import type { VehicleSearchQuery } from '../../lib/api/types.js';

export interface VehicleFilterValues {
  make: string;
  model: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  sortBy: VehicleSearchQuery['sortBy'];
  sortOrder: VehicleSearchQuery['sortOrder'];
}

export const defaultVehicleFilters: VehicleFilterValues = {
  make: '',
  model: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  inStock: false,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
