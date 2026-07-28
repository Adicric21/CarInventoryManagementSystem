import type { TokenProvider } from '../auth/domain/token-provider.js';
import { ListPurchasesService } from './application/list-purchases.js';
import type { PurchaseDependencies } from './domain/purchase-repository.js';
import { PurchaseController } from './http/purchase-controller.js';
import { createPurchaseRouters } from './http/purchase-routes.js';

interface PurchaseModuleDependencies extends PurchaseDependencies {
  tokenProvider: TokenProvider;
}

export function createPurchaseModule(dependencies: PurchaseModuleDependencies) {
  return createPurchaseRouters(
    new PurchaseController(new ListPurchasesService(dependencies)),
    dependencies.tokenProvider,
  );
}
