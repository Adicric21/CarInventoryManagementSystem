import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../lib/api/client.js';
import { PurchaseHistoryPage } from './purchase-history-page.js';

describe('purchase history page', () => {
  it('renders durable vehicle snapshots and decimal money values', async () => {
    vi.spyOn(apiClient, 'getMyPurchases').mockResolvedValue({
      data: [
        {
          id: 'purchase-1',
          vehicleId: null,
          vehicleMake: 'Toyota',
          vehicleModel: 'Fortuner',
          vehicleCategory: 'SUV',
          unitPrice: '3500000.25',
          quantity: 2,
          totalAmount: '7000000.50',
          purchasedAt: '2026-07-23T09:00:00.000Z',
          purchasedBy: {
            id: 'user-1',
            name: 'Uma User',
            email: 'uma@example.com',
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PurchaseHistoryPage mode="personal" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Toyota Fortuner')).toBeVisible();
    expect(screen.getByText('₹70,00,000.50')).toBeVisible();
  });
});
