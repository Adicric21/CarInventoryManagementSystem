import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { ActivityLogPage } from './activity-log-page.js';
import { apiClient } from '../../lib/api/client.js';

describe('administrator inventory activity log', () => {
  it('renders readable activity details and the deleted-vehicle snapshot', async () => {
    vi.spyOn(apiClient, 'getInventoryActivities').mockResolvedValue({
      data: [
        {
          id: 'activity-1',
          action: 'VEHICLE_DELETED',
          vehicleId: null,
          vehicleMake: 'Toyota',
          vehicleModel: 'Fortuner',
          vehicleCategory: 'SUV',
          quantityBefore: 5,
          quantityChange: -5,
          quantityAfter: 0,
          performedBy: {
            id: 'admin-1',
            name: 'Asha Admin',
            email: 'asha@example.com',
          },
          createdAt: '2026-07-23T09:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ActivityLogPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Toyota Fortuner')).toBeVisible();
    expect(screen.getAllByText('Vehicle deleted')).toHaveLength(2);
    expect(screen.getByText('Asha Admin')).toBeVisible();
  });
});
