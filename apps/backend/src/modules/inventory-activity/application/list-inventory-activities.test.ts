import { describe, expect, it, vi } from 'vitest';

import { ListInventoryActivitiesService } from './list-inventory-activities.js';
import type { InventoryActivityRepository } from '../domain/inventory-activity-repository.js';

const ACTIVITY = {
  id: '10000000-0000-4000-8000-000000000001',
  action: 'VEHICLE_CREATED' as const,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicleMake: 'Toyota',
  vehicleModel: 'Fortuner',
  vehicleCategory: 'SUV',
  quantityBefore: null,
  quantityChange: 5,
  quantityAfter: 5,
  performedBy: {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Asha Admin',
    email: 'asha@example.com',
  },
  metadata: null,
  createdAt: new Date('2026-07-23T09:00:00.000Z'),
};

function repositoryDouble() {
  return {
    findMany: vi.fn(() => Promise.resolve([ACTIVITY])),
    count: vi.fn(() => Promise.resolve(1)),
  } satisfies InventoryActivityRepository;
}

describe('list inventory activities', () => {
  it('filters and paginates in persistence with newest-first ordering by default', async () => {
    const repository = repositoryDouble();
    const service = new ListInventoryActivitiesService({ inventoryActivityRepository: repository });

    const result = await service.execute({
      action: 'VEHICLE_CREATED',
      page: '2',
      limit: '10',
    });

    expect(repository.findMany).toHaveBeenCalledWith({
      filters: { action: 'VEHICLE_CREATED' },
      pagination: { skip: 10, take: 10 },
      sortOrder: 'desc',
    });
    expect(result).toEqual({
      data: [
        {
          id: ACTIVITY.id,
          action: ACTIVITY.action,
          vehicleId: ACTIVITY.vehicleId,
          vehicleMake: ACTIVITY.vehicleMake,
          vehicleModel: ACTIVITY.vehicleModel,
          vehicleCategory: ACTIVITY.vehicleCategory,
          quantityBefore: ACTIVITY.quantityBefore,
          quantityChange: ACTIVITY.quantityChange,
          quantityAfter: ACTIVITY.quantityAfter,
          performedBy: ACTIVITY.performedBy,
          createdAt: '2026-07-23T09:00:00.000Z',
        },
      ],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('rejects invalid filters before querying persistence', async () => {
    const repository = repositoryDouble();
    const service = new ListInventoryActivitiesService({ inventoryActivityRepository: repository });

    await expect(service.execute({ action: 'NOT_AN_ACTION' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(repository.findMany).not.toHaveBeenCalled();
    expect(repository.count).not.toHaveBeenCalled();
  });
});
