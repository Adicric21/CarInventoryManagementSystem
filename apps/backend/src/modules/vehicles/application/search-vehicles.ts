import { VehicleError, unexpectedVehicleError } from '../domain/vehicle-errors.js';
import type { VehicleDependencies, VehicleFilters } from '../domain/vehicle-repository.js';
import type { VehiclePage } from '../domain/vehicle-types.js';
import { loadVehiclePage } from './vehicle-page.js';
import { parseSearchVehiclesQuery } from './vehicle-validation.js';

export interface SearchVehicles {
  execute(query: unknown): Promise<VehiclePage>;
}

export class SearchVehiclesService implements SearchVehicles {
  constructor(private readonly dependencies: VehicleDependencies) {}

  async execute(query: unknown): Promise<VehiclePage> {
    const parsedQuery = parseSearchVehiclesQuery(query);
    const filters: VehicleFilters = {
      ...(parsedQuery.make === undefined ? {} : { make: parsedQuery.make }),
      ...(parsedQuery.model === undefined ? {} : { model: parsedQuery.model }),
      ...(parsedQuery.category === undefined ? {} : { category: parsedQuery.category }),
      ...(parsedQuery.minPrice === undefined ? {} : { minPrice: parsedQuery.minPrice }),
      ...(parsedQuery.maxPrice === undefined ? {} : { maxPrice: parsedQuery.maxPrice }),
      ...(parsedQuery.inStock === undefined ? {} : { inStock: parsedQuery.inStock }),
    };

    try {
      return await loadVehiclePage(
        this.dependencies.vehicleRepository,
        {
          page: parsedQuery.page,
          limit: parsedQuery.limit,
          filters,
          sort: { field: parsedQuery.sortBy, order: parsedQuery.sortOrder },
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
