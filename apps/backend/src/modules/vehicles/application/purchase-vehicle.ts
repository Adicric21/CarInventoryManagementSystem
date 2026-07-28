import {
  insufficientStockError,
  unexpectedVehicleError,
  VehicleError,
  vehicleNotFoundError,
} from '../domain/vehicle-errors.js';
import type { AtomicPurchaseResult, VehicleDependencies } from '../domain/vehicle-repository.js';
import { toVehicle, type Vehicle } from '../domain/vehicle-types.js';
import { parseInventoryQuantityInput, parseVehicleId } from './vehicle-validation.js';

export interface PurchaseVehicle {
  execute(id: string, input: unknown, performedById?: string): Promise<Vehicle>;
}

function mapPurchaseResult(result: AtomicPurchaseResult, lowStockThreshold: number): Vehicle {
  switch (result.outcome) {
    case 'updated':
      return toVehicle(result.vehicle, lowStockThreshold);
    case 'notFound':
      throw vehicleNotFoundError();
    case 'insufficientStock':
      throw insufficientStockError();
  }
}

export class PurchaseVehicleService implements PurchaseVehicle {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(id: string, input: unknown, performedById = ''): Promise<Vehicle> {
    const vehicleId = parseVehicleId(id);
    const { quantity } = parseInventoryQuantityInput(input);

    try {
      const result = await this.dependencies.vehicleRepository.purchaseWithActivity(
        vehicleId,
        quantity,
        performedById,
      );
      return mapPurchaseResult(result, this.dependencies.lowStockThreshold);
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
