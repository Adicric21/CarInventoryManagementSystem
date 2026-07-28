import { VehicleError, unexpectedVehicleError } from '../domain/vehicle-errors.js';
import type { VehicleDependencies } from '../domain/vehicle-repository.js';
import { toVehicle, type Vehicle } from '../domain/vehicle-types.js';
import { parseCreateVehicleInput } from './vehicle-validation.js';

export interface CreateVehicle {
  execute(input: unknown, performedById?: string): Promise<Vehicle>;
}

export class CreateVehicleService implements CreateVehicle {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(input: unknown, performedById = ''): Promise<Vehicle> {
    const vehicle = parseCreateVehicleInput(input);

    try {
      const createdVehicle = await this.dependencies.vehicleRepository.createWithActivity(
        {
          ...vehicle,
          price: String(vehicle.price),
        },
        performedById,
      );

      return toVehicle(createdVehicle, this.dependencies.lowStockThreshold);
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
