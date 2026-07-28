import { describe, expect, it, vi } from 'vitest';

import type { DashboardRepository } from '../domain/dashboard-repository.js';
import { GetDashboardService } from './get-dashboard.js';

function repositoryDouble() {
  const getDashboard = vi.fn(() =>
    Promise.resolve({
      summary: {
        vehicleCount: 2,
        totalStockUnits: 5,
        inventoryValue: '7250000.00',
        lowStockCount: 1,
        outOfStockCount: 0,
        purchaseCount: 1,
        unitsPurchased: 2,
        purchaseRevenue: '7000000.50',
      },
      vehiclesByCategory: [{ category: 'SUV', vehicleCount: 2, stockUnits: 5 }],
      purchasesByDay: [
        {
          date: '2026-07-23',
          purchaseCount: 1,
          unitsPurchased: 2,
          revenue: '7000000.50',
        },
      ],
      topPurchasedVehicles: [
        {
          vehicleMake: 'Toyota',
          vehicleModel: 'Fortuner',
          unitsPurchased: 2,
          revenue: '7000000.50',
        },
      ],
      recentActivities: [],
    }),
  );
  return { repository: { getDashboard } satisfies DashboardRepository, getDashboard };
}

describe('administrator dashboard', () => {
  it('defaults to 30 days and passes the authoritative stock threshold', async () => {
    const { repository, getDashboard } = repositoryDouble();
    const now = new Date('2026-07-23T12:00:00.000Z');
    const service = new GetDashboardService({
      dashboardRepository: repository,
      lowStockThreshold: 3,
      now: () => now,
    });

    const result = await service.execute({});

    expect(result.data.summary.purchaseRevenue).toBe('7000000.50');
    expect(getDashboard).toHaveBeenCalledWith({
      from: new Date('2026-06-23T12:00:00.000Z'),
      lowStockThreshold: 3,
    });
  });

  it('rejects unsupported periods before querying persistence', async () => {
    const { repository, getDashboard } = repositoryDouble();
    const service = new GetDashboardService({
      dashboardRepository: repository,
      lowStockThreshold: 3,
    });

    await expect(service.execute({ period: '1y' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(getDashboard).not.toHaveBeenCalled();
  });
});
