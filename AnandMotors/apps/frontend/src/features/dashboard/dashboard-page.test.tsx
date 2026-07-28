import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../lib/api/client.js';
import { DashboardPage } from './dashboard-page.js';

describe('administrator dashboard', () => {
  it('renders analytics and reloads them for a selected period', async () => {
    const dashboard = {
      summary: {
        vehicleCount: 4,
        totalStockUnits: 12,
        inventoryValue: '7250000.00',
        lowStockCount: 1,
        outOfStockCount: 1,
        purchaseCount: 2,
        unitsPurchased: 3,
        purchaseRevenue: '7000000.50',
      },
      vehiclesByCategory: [{ category: 'SUV', vehicleCount: 3, stockUnits: 10 }],
      purchasesByDay: [
        {
          date: '2026-07-23',
          purchaseCount: 2,
          unitsPurchased: 3,
          revenue: '7000000.50',
        },
      ],
      topPurchasedVehicles: [
        {
          vehicleMake: 'Toyota',
          vehicleModel: 'Fortuner',
          unitsPurchased: 3,
          revenue: '7000000.50',
        },
      ],
      recentActivities: [],
    };
    const getDashboard = vi.spyOn(apiClient, 'getAdminDashboard').mockResolvedValue(dashboard);
    vi.spyOn(apiClient, 'getLowStockVehicles').mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('₹70,00,000.50')).length).toBeGreaterThan(0);
    expect(screen.getByText('Toyota Fortuner')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Analytics period'), { target: { value: '7d' } });
    expect(await screen.findByDisplayValue('Last 7 days')).toBeVisible();
    expect(getDashboard).toHaveBeenLastCalledWith('7d');
  });
});
