import { VehicleError, unexpectedVehicleError } from '../../vehicles/domain/vehicle-errors.js';
import type { DashboardRepository } from '../domain/dashboard-repository.js';
import type { DashboardData } from '../domain/dashboard-types.js';
import { parseDashboardQuery } from './dashboard-validation.js';

interface DashboardDependencies {
  dashboardRepository: DashboardRepository;
  lowStockThreshold: number;
  now?: () => Date;
}

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

export class GetDashboardService {
  public constructor(private readonly dependencies: DashboardDependencies) {}

  public async execute(query: unknown): Promise<{ data: DashboardData }> {
    const { period } = parseDashboardQuery(query);
    const now = this.dependencies.now?.() ?? new Date();
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - PERIOD_DAYS[period]);

    try {
      return {
        data: await this.dependencies.dashboardRepository.getDashboard({
          from,
          lowStockThreshold: this.dependencies.lowStockThreshold,
        }),
      };
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }
      throw unexpectedVehicleError();
    }
  }
}
