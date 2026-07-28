import type { TokenProvider } from '../auth/domain/token-provider.js';
import { CreateVehicleService } from './application/create-vehicle.js';
import { DeleteVehicleService } from './application/delete-vehicle.js';
import { ListVehiclesService } from './application/list-vehicles.js';
import { ListLowStockVehiclesService } from './application/list-low-stock-vehicles.js';
import { PurchaseVehicleService } from './application/purchase-vehicle.js';
import { RestockVehicleService } from './application/restock-vehicle.js';
import { SearchVehiclesService } from './application/search-vehicles.js';
import { UpdateVehicleService } from './application/update-vehicle.js';
import type { VehicleDependencies } from './domain/vehicle-repository.js';
import { VehicleController } from './http/vehicle-controller.js';
import { createAdminVehicleRouter, createVehicleRouter } from './http/vehicle-routes.js';

export interface VehicleModuleDependencies extends VehicleDependencies {
  tokenProvider: TokenProvider;
}

export function createVehicleModule(dependencies: VehicleModuleDependencies) {
  const controller = new VehicleController({
    createVehicle: new CreateVehicleService(dependencies),
    listVehicles: new ListVehiclesService(dependencies),
    searchVehicles: new SearchVehiclesService(dependencies),
    listLowStockVehicles: new ListLowStockVehiclesService(dependencies),
    updateVehicle: new UpdateVehicleService(dependencies),
    deleteVehicle: new DeleteVehicleService(dependencies),
    purchaseVehicle: new PurchaseVehicleService(dependencies),
    restockVehicle: new RestockVehicleService(dependencies),
  });

  return {
    router: createVehicleRouter(controller, dependencies.tokenProvider),
    adminRouter: createAdminVehicleRouter(controller, dependencies.tokenProvider),
  };
}
