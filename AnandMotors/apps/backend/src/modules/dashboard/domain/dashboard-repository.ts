import type { DashboardData } from './dashboard-types.js';

export interface DashboardQuery {
  from: Date;
  lowStockThreshold: number;
}

export interface DashboardRepository {
  getDashboard(query: DashboardQuery): Promise<DashboardData>;
}
