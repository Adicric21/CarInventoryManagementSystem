import { describe, expect, it, vi } from 'vitest';

import { ListLowStockVehiclesService } from './list-low-stock-vehicles.js';
import { createPersistedVehicleFixture } from '../test-support/vehicle-fixtures.js';

function repositoryDouble() {
  return {
    findMany: vi.fn(() =>
      Promise.resolve([
        createPersistedVehicleFixture({ model: 'Empty', quantity: 0 }),
        createPersistedVehicleFixture({ model: 'Low', quantity: 3 }),
      ]),
    ),
    count: vi.fn(() => Promise.resolve(2)),
  };
}

describe('list low-stock vehicles', () => {
  it('filters in persistence using the server threshold and defaults to quantity ordering', async () => {
    const repository = repositoryDouble();
    const service = new ListLowStockVehiclesService({
      vehicleRepository: repository,
      lowStockThreshold: 3,
    });

    const result = await service.execute({ page: '1', limit: '20' });

    expect(repository.findMany).toHaveBeenCalledWith({
      filters: { maxQuantity: 3 },
      pagination: { skip: 0, take: 20 },
      sort: { field: 'quantity', order: 'asc' },
      secondarySort: { field: 'make', order: 'asc' },
    });
    expect(result.data.map(({ stockStatus }) => stockStatus)).toEqual([
      'OUT_OF_STOCK',
      'LOW_STOCK',
    ]);
  });

  it('rejects unsupported sorting before querying persistence', async () => {
    const repository = repositoryDouble();
    const service = new ListLowStockVehiclesService({
      vehicleRepository: repository,
      lowStockThreshold: 3,
    });

    await expect(service.execute({ sortBy: 'price' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(repository.findMany).not.toHaveBeenCalled();
  });
});
