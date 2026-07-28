import {
  VehicleError,
  unexpectedVehicleError,
  vehicleNotFoundError,
} from '../domain/vehicle-errors.js';
import type { VehicleDependencies } from '../domain/vehicle-repository.js';
import { parseVehicleId } from './vehicle-validation.js';

export interface DeleteVehicle {
  execute(id: string, performedById?: string): Promise<void>;
}

export class DeleteVehicleService implements DeleteVehicle {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(id: string, performedById = ''): Promise<void> {
    const vehicleId = parseVehicleId(id);

    try {
      const deleted = await this.dependencies.vehicleRepository.deleteWithActivity(
        vehicleId,
        performedById,
      );

      if (!deleted) {
        throw vehicleNotFoundError();
      }
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
