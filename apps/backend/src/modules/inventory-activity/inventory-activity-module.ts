import type { TokenProvider } from '../auth/domain/token-provider.js';
import { ListInventoryActivitiesService } from './application/list-inventory-activities.js';
import type { InventoryActivityDependencies } from './domain/inventory-activity-repository.js';
import { InventoryActivityController } from './http/inventory-activity-controller.js';
import { createInventoryActivityRouter } from './http/inventory-activity-routes.js';

interface InventoryActivityModuleDependencies extends InventoryActivityDependencies {
  tokenProvider: TokenProvider;
}

export function createInventoryActivityModule(dependencies: InventoryActivityModuleDependencies) {
  const controller = new InventoryActivityController(
    new ListInventoryActivitiesService(dependencies),
  );

  return {
    router: createInventoryActivityRouter(controller, dependencies.tokenProvider),
  };
}
