import { vi } from 'vitest';

import type { VehicleRepository } from './vehicle-contracts.js';
import { createPersistedVehicleFixture } from './vehicle-fixtures.js';

export function createVehicleRepositoryDouble() {
  const create = vi.fn<VehicleRepository['create']>((input) =>
    Promise.resolve(createPersistedVehicleFixture(input)),
  );
  const createWithActivity = vi.fn<VehicleRepository['createWithActivity']>((input, _actorId) =>
    create(input),
  );
  const findMany = vi.fn<VehicleRepository['findMany']>((_query) => Promise.resolve([]));
  const count = vi.fn<VehicleRepository['count']>((_filters) => Promise.resolve(0));
  const findById = vi.fn<VehicleRepository['findById']>((_id) =>
    Promise.resolve(createPersistedVehicleFixture()),
  );
  const update = vi.fn<VehicleRepository['update']>((_id, input) =>
    Promise.resolve(createPersistedVehicleFixture(input)),
  );
  const updateWithActivity = vi.fn<VehicleRepository['updateWithActivity']>(
    async (id, input, _actorId) => {
      const existing = await findById(id);
      return existing === null ? null : update(id, input);
    },
  );
  const deleteVehicle = vi.fn<VehicleRepository['delete']>((_id) => Promise.resolve(true));
  const deleteWithActivity = vi.fn<VehicleRepository['deleteWithActivity']>(
    async (id, _actorId) => {
      const existing = await findById(id);
      return existing === null ? false : deleteVehicle(id);
    },
  );
  const purchaseAtomic = vi.fn<VehicleRepository['purchaseAtomic']>((_id, quantity) =>
    Promise.resolve({
      outcome: 'updated',
      vehicle: createPersistedVehicleFixture({ quantity: 5 - quantity }),
    }),
  );
  const purchaseWithActivity = vi.fn<VehicleRepository['purchaseWithActivity']>(
    (id, quantity, _actorId) => purchaseAtomic(id, quantity),
  );
  const restockAtomic = vi.fn<VehicleRepository['restockAtomic']>((_id, quantity) =>
    Promise.resolve(createPersistedVehicleFixture({ quantity: 5 + quantity })),
  );
  const restockWithActivity = vi.fn<VehicleRepository['restockWithActivity']>(
    (id, quantity, _actorId) => restockAtomic(id, quantity),
  );

  return {
    create,
    createWithActivity,
    findMany,
    count,
    findById,
    update,
    updateWithActivity,
    delete: deleteVehicle,
    deleteWithActivity,
    purchaseAtomic,
    purchaseWithActivity,
    restockAtomic,
    restockWithActivity,
  } satisfies VehicleRepository;
}

export function createVehicleDependencies() {
  return {
    vehicleRepository: createVehicleRepositoryDouble(),
    lowStockThreshold: 3,
  };
}
