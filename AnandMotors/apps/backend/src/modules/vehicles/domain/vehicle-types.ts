export const VEHICLE_SORT_FIELDS = [
  'make',
  'model',
  'category',
  'price',
  'quantity',
  'createdAt',
] as const;

export type VehicleSortField = (typeof VEHICLE_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
  stockStatus: StockStatus;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedVehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleInput {
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VehiclePage {
  data: Vehicle[];
  meta: PaginationMeta;
}

export function toVehicle(vehicle: PersistedVehicle, lowStockThreshold: number): Vehicle {
  return {
    ...vehicle,
    ...getStockStatus(vehicle.quantity, lowStockThreshold),
    price: Number(vehicle.price),
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}
import { getStockStatus, type StockStatus } from './stock-status.js';
