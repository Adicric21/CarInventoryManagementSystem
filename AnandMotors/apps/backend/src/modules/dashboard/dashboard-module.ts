import type { TokenProvider } from '../auth/domain/token-provider.js';
import { GetDashboardService } from './application/get-dashboard.js';
import type { DashboardRepository } from './domain/dashboard-repository.js';
import { DashboardController } from './http/dashboard-controller.js';
import { createDashboardRouter } from './http/dashboard-routes.js';

interface DashboardModuleDependencies {
  dashboardRepository: DashboardRepository;
  lowStockThreshold: number;
  tokenProvider: TokenProvider;
}

export function createDashboardModule(dependencies: DashboardModuleDependencies) {
  return {
    router: createDashboardRouter(
      new DashboardController(new GetDashboardService(dependencies)),
      dependencies.tokenProvider,
    ),
  };
}
