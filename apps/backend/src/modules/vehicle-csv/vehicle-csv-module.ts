import type { TokenProvider } from '../auth/domain/token-provider.js';
import { VehicleCsvService } from './application/vehicle-csv.js';
import type { BulkVehicleRepository } from './domain/bulk-vehicle-repository.js';
import { VehicleCsvController } from './http/vehicle-csv-controller.js';
import { createVehicleCsvRouter } from './http/vehicle-csv-routes.js';

interface VehicleCsvModuleDependencies {
  bulkVehicleRepository: BulkVehicleRepository;
  tokenProvider: TokenProvider;
}

export function createVehicleCsvModule(dependencies: VehicleCsvModuleDependencies) {
  return {
    router: createVehicleCsvRouter(
      new VehicleCsvController(new VehicleCsvService(dependencies)),
      dependencies.tokenProvider,
    ),
  };
}
