import {
  VehicleError,
  unexpectedVehicleError,
  vehicleNotFoundError,
} from '../domain/vehicle-errors.js';
import type { UpdateVehicleData, VehicleDependencies } from '../domain/vehicle-repository.js';
import { toVehicle, type Vehicle } from '../domain/vehicle-types.js';
import { parseUpdateVehicleInput, parseVehicleId } from './vehicle-validation.js';

export interface UpdateVehicle {
  execute(id: string, input: unknown, performedById?: string): Promise<Vehicle>;
}

export class UpdateVehicleService implements UpdateVehicle {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(id: string, input: unknown, performedById = ''): Promise<Vehicle> {
    const vehicleId = parseVehicleId(id);
    const vehicle = parseUpdateVehicleInput(input);
    const updateData: UpdateVehicleData = {
      ...(vehicle.make === undefined ? {} : { make: vehicle.make }),
      ...(vehicle.model === undefined ? {} : { model: vehicle.model }),
      ...(vehicle.category === undefined ? {} : { category: vehicle.category }),
      ...(vehicle.price === undefined ? {} : { price: String(vehicle.price) }),
      ...(vehicle.quantity === undefined ? {} : { quantity: vehicle.quantity }),
    };

    try {
      const updatedVehicle = await this.dependencies.vehicleRepository.updateWithActivity(
        vehicleId,
        updateData,
        performedById,
      );

      if (updatedVehicle === null) {
        throw vehicleNotFoundError();
      }

      return toVehicle(updatedVehicle, this.dependencies.lowStockThreshold);
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
