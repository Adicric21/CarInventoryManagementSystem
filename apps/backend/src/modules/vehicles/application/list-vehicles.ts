import { VehicleError, unexpectedVehicleError } from '../domain/vehicle-errors.js';
import type { VehicleDependencies } from '../domain/vehicle-repository.js';
import type { VehiclePage } from '../domain/vehicle-types.js';
import { loadVehiclePage } from './vehicle-page.js';
import { parseListVehiclesQuery } from './vehicle-validation.js';

export interface ListVehicles {
  execute(query: unknown): Promise<VehiclePage>;
}

export class ListVehiclesService implements ListVehicles {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(query: unknown): Promise<VehiclePage> {
    const pagination = parseListVehiclesQuery(query);

    try {
      return await loadVehiclePage(
        this.dependencies.vehicleRepository,
        {
          ...pagination,
          filters: {},
          sort: { field: 'createdAt', order: 'desc' },
        },
        this.dependencies.lowStockThreshold,
      );
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
