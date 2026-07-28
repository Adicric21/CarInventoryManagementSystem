import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../lib/api/client.js';
import { LowStockPage } from './low-stock-page.js';

describe('administrator low-stock page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders low-stock and out-of-stock vehicles using server-provided status', async () => {
    vi.spyOn(apiClient, 'getLowStockVehicles').mockResolvedValue({
      data: [
        {
          id: 'vehicle-1',
          make: 'Toyota',
          model: 'Fortuner',
          category: 'SUV',
          price: 3_500_000,
          quantity: 0,
          stockStatus: 'OUT_OF_STOCK',
          isLowStock: true,
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <LowStockPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Toyota Fortuner')).toBeVisible();
    expect(screen.getByText('Out of stock')).toBeVisible();
    expect(screen.getByRole('button', { name: /restock toyota fortuner/i })).toBeEnabled();
  });

  it('quick-restocks and removes a vehicle that the server marks in stock', async () => {
    const lowVehicle = {
      id: 'vehicle-1',
      make: 'Toyota',
      model: 'Fortuner',
      category: 'SUV',
      price: 3_500_000,
      quantity: 1,
      stockStatus: 'LOW_STOCK' as const,
      isLowStock: true,
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
    };
    vi.spyOn(apiClient, 'getLowStockVehicles')
      .mockResolvedValueOnce({
        data: [lowVehicle],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
      .mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    const restock = vi.spyOn(apiClient, 'restockVehicle').mockResolvedValue({
      ...lowVehicle,
      quantity: 6,
      stockStatus: 'IN_STOCK',
      isLowStock: false,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <LowStockPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /restock toyota fortuner/i }));
    await user.type(screen.getByLabelText(/restock quantity/i), '5');
    await user.click(screen.getByRole('button', { name: /^restock vehicle$/i }));

    expect(restock).toHaveBeenCalledWith('vehicle-1', 5);
    expect(await screen.findByRole('heading', { name: /no low-stock vehicles/i })).toBeVisible();
  });
});
