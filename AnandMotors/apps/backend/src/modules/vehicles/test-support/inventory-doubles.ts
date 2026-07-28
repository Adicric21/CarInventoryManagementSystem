import { createVehicleRepositoryDouble } from './vehicle-doubles.js';

export function createInventoryVehicleRepositoryDouble() {
  return createVehicleRepositoryDouble();
}

export function createInventoryDependencies() {
  return {
    vehicleRepository: createInventoryVehicleRepositoryDouble(),
    lowStockThreshold: 3,
  };
}
