import type {
  VehicleFilters,
  VehicleRepository,
  VehicleSort,
} from '../domain/vehicle-repository.js';
import { toVehicle, type VehiclePage } from '../domain/vehicle-types.js';

export interface PageOptions {
  page: number;
  limit: number;
  filters: VehicleFilters;
  sort: VehicleSort;
  secondarySort?: VehicleSort;
}

export async function loadVehiclePage(
  vehicleRepository: Pick<VehicleRepository, 'findMany' | 'count'>,
  options: PageOptions,
  lowStockThreshold: number,
): Promise<VehiclePage> {
  const [vehicles, total] = await Promise.all([
    vehicleRepository.findMany({
      filters: options.filters,
      pagination: {
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      },
      sort: options.sort,
      ...(options.secondarySort === undefined ? {} : { secondarySort: options.secondarySort }),
    }),
    vehicleRepository.count(options.filters),
  ]);

  return {
    data: vehicles.map((vehicle) => toVehicle(vehicle, lowStockThreshold)),
    meta: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit),
    },
  };
}
