import type {
  CreateVehicleInput,
  PersistedVehicle,
  UpdateVehicleInput,
  Vehicle,
} from './vehicle-contracts.js';
import { getStockStatus } from '../domain/stock-status.js';

export const VEHICLE_ID = '2a4c472f-07bf-4d65-98ca-5641d09c4e27';
export const SECOND_VEHICLE_ID = '7914842d-03a0-4c5c-adb1-a73ebff32ec8';
export const CREATED_AT = '2026-07-20T09:30:00.000Z';
export const UPDATED_AT = '2026-07-21T11:45:00.000Z';

export function createCreateVehicleInput(
  overrides: Partial<CreateVehicleInput> = {},
): CreateVehicleInput {
  return {
    make: 'Toyota',
    model: 'Fortuner',
    category: 'SUV',
    price: 3_500_000,
    quantity: 5,
    ...overrides,
  };
}

export function createUpdateVehicleInput(overrides: UpdateVehicleInput = {}): UpdateVehicleInput {
  return {
    make: 'Toyota',
    model: 'Fortuner Legender',
    category: 'SUV',
    price: 4_200_000,
    quantity: 3,
    ...overrides,
  };
}

export function createVehicleFixture(overrides: Partial<Vehicle> = {}): Vehicle {
  const quantity = overrides.quantity ?? 5;

  return {
    id: VEHICLE_ID,
    make: 'Toyota',
    model: 'Fortuner',
    category: 'SUV',
    price: 3_500_000,
    quantity,
    ...getStockStatus(quantity, 3),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

export function createPersistedVehicleFixture(
  overrides: Partial<PersistedVehicle> = {},
): PersistedVehicle {
  return {
    id: VEHICLE_ID,
    make: 'Toyota',
    model: 'Fortuner',
    category: 'SUV',
    price: '3500000',
    quantity: 5,
    createdAt: new Date(CREATED_AT),
    updatedAt: new Date(UPDATED_AT),
    ...overrides,
  };
}
