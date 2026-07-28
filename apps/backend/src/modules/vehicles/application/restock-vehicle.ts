import {
  unexpectedVehicleError,
  VehicleError,
  vehicleNotFoundError,
} from '../domain/vehicle-errors.js';
import type { VehicleDependencies } from '../domain/vehicle-repository.js';
import { toVehicle, type Vehicle } from '../domain/vehicle-types.js';
import { parseInventoryQuantityInput, parseVehicleId } from './vehicle-validation.js';

export interface RestockVehicle {
  execute(id: string, input: unknown, performedById?: string): Promise<Vehicle>;
}

export class RestockVehicleService implements RestockVehicle {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(id: string, input: unknown, performedById = ''): Promise<Vehicle> {
    const vehicleId = parseVehicleId(id);
    const { quantity } = parseInventoryQuantityInput(input);

    try {
      const vehicle = await this.dependencies.vehicleRepository.restockWithActivity(
        vehicleId,
        quantity,
        performedById,
      );

      if (vehicle === null) {
        throw vehicleNotFoundError();
      }

      return toVehicle(vehicle, this.dependencies.lowStockThreshold);
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
