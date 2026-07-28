import { VehicleError, unexpectedVehicleError } from '../domain/vehicle-errors.js';
import type { VehicleRepository } from '../domain/vehicle-repository.js';
import type { VehiclePage } from '../domain/vehicle-types.js';
import { loadVehiclePage } from './vehicle-page.js';
import { parseLowStockVehiclesQuery } from './vehicle-validation.js';

interface LowStockDependencies {
  vehicleRepository: Pick<VehicleRepository, 'findMany' | 'count'>;
  lowStockThreshold: number;
}

export class ListLowStockVehiclesService {
  public constructor(private readonly dependencies: LowStockDependencies) {}

  public async execute(query: unknown): Promise<VehiclePage> {
    const parsed = parseLowStockVehiclesQuery(query);

    try {
      return await loadVehiclePage(
        this.dependencies.vehicleRepository,
        {
          page: parsed.page,
          limit: parsed.limit,
          filters: { maxQuantity: this.dependencies.lowStockThreshold },
          sort: { field: parsed.sortBy, order: parsed.sortOrder },
          ...(parsed.sortBy === 'quantity'
            ? { secondarySort: { field: 'make' as const, order: 'asc' as const } }
            : {}),
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
