import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../lib/api/client.js';
import { VehicleCsvPage } from './vehicle-csv-page.js';

describe('vehicle CSV page', () => {
  it('previews a valid file, imports it once, and resets the form', async () => {
    const preview = vi.spyOn(apiClient, 'previewVehicleCsv').mockResolvedValue({
      headers: ['make', 'model', 'category', 'price', 'quantity'],
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [
        {
          row: 2,
          make: 'Toyota',
          model: 'Fortuner',
          category: 'SUV',
          price: '3500000',
          quantity: 5,
        },
      ],
      errors: [],
    });
    const importCsv = vi.spyOn(apiClient, 'importVehicleCsv').mockResolvedValue({ imported: 1 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <VehicleCsvPage />
      </QueryClientProvider>,
    );
    const file = new File(['make,model,category,price,quantity'], 'vehicles.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: 'Preview CSV' }));

    expect(await screen.findByText('1 valid row')).toBeVisible();
    expect(preview).toHaveBeenCalledWith(file);
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByText('Imported 1 vehicle.')).toBeVisible();
    expect(importCsv).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('CSV file')).toHaveValue('');
  });
});
