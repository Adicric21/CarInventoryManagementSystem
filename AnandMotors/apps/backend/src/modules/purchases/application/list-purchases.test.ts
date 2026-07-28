import { describe, expect, it, vi } from 'vitest';

import { ListPurchasesService } from './list-purchases.js';
import type { PurchaseRepository } from '../domain/purchase-repository.js';

function repositoryDouble() {
  return {
    findMany: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
  } satisfies PurchaseRepository;
}

describe('purchase history', () => {
  it('scopes personal history to the authenticated user in persistence', async () => {
    const repository = repositoryDouble();
    const service = new ListPurchasesService({ purchaseRepository: repository });

    await service.forUser('user-id', { page: '2', limit: '10', make: 'Toyota' });

    expect(repository.findMany).toHaveBeenCalledWith({
      filters: { userId: 'user-id', make: 'Toyota' },
      pagination: { skip: 10, take: 10 },
      sortOrder: 'desc',
    });
  });

  it('rejects invalid administrator filters before persistence', async () => {
    const repository = repositoryDouble();
    const service = new ListPurchasesService({ purchaseRepository: repository });

    await expect(service.forAdmin({ userId: 'not-a-uuid' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(repository.findMany).not.toHaveBeenCalled();
  });
});
