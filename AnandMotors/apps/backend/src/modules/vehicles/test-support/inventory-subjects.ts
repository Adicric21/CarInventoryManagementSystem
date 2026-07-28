import type {
  InventoryDependencies,
  PurchaseVehicle,
  RestockVehicle,
} from './inventory-contracts.js';
import { PurchaseVehicleService } from '../application/purchase-vehicle.js';
import { RestockVehicleService } from '../application/restock-vehicle.js';

export function createPurchaseVehicleSubject(dependencies: InventoryDependencies): PurchaseVehicle {
  return new PurchaseVehicleService(dependencies);
}

export function createRestockVehicleSubject(dependencies: InventoryDependencies): RestockVehicle {
  return new RestockVehicleService(dependencies);
}
