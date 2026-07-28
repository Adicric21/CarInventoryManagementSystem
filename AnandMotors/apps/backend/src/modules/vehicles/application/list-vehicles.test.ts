import { describe, expect, it } from 'vitest';

import type { FindVehiclesQuery } from '../test-support/vehicle-contracts.js';
import { createVehicleDependencies } from '../test-support/vehicle-doubles.js';
import {
  createPersistedVehicleFixture,
  createVehicleFixture,
  SECOND_VEHICLE_ID,
} from '../test-support/vehicle-fixtures.js';
import { createListVehiclesSubject } from '../test-support/vehicle-subjects.js';
import { captureExpectedVehicleError } from '../test-support/vehicle-test-helpers.js';

const DEFAULT_REPOSITORY_QUERY = {
  filters: {},
  pagination: { skip: 0, take: 10 },
  sort: { field: 'createdAt', order: 'desc' },
} satisfies FindVehiclesQuery;

function expectValidationError(error: unknown): void {
  expect(error).toMatchObject({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'The request is invalid.',
  });
}

describe('list vehicles', () => {
  it('returns an empty first page with sensible defaults', async () => {
    const dependencies = createVehicleDependencies();
    const listVehicles = createListVehiclesSubject(dependencies);

    const result = await listVehicles.execute({});

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(DEFAULT_REPOSITORY_QUERY);
    expect(dependencies.vehicleRepository.count).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith({});
  });

  it('requests deterministic newest-first ordering and preserves repository order', async () => {
    const dependencies = createVehicleDependencies();
    const newerVehicle = createPersistedVehicleFixture({
      id: SECOND_VEHICLE_ID,
      make: 'Honda',
      createdAt: new Date('2026-07-22T09:30:00.000Z'),
      updatedAt: new Date('2026-07-22T09:30:00.000Z'),
    });
    const olderVehicle = createPersistedVehicleFixture();
    dependencies.vehicleRepository.findMany.mockResolvedValue([newerVehicle, olderVehicle]);
    dependencies.vehicleRepository.count.mockResolvedValue(2);
    const listVehicles = createListVehiclesSubject(dependencies);

    const result = await listVehicles.execute({});

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(DEFAULT_REPOSITORY_QUERY);
    expect(result.data.map(({ id }) => id)).toEqual([SECOND_VEHICLE_ID, olderVehicle.id]);
  });

  it('performs pagination in the repository and returns complete metadata', async () => {
    const dependencies = createVehicleDependencies();
    dependencies.vehicleRepository.findMany.mockResolvedValue([createPersistedVehicleFixture()]);
    dependencies.vehicleRepository.count.mockResolvedValue(14);
    const listVehicles = createListVehiclesSubject(dependencies);

    const result = await listVehicles.execute({ page: '2', limit: '5' });

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith({
      filters: {},
      pagination: { skip: 5, take: 5 },
      sort: { field: 'createdAt', order: 'desc' },
    });
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 14, totalPages: 3 });
  });

  it('accepts the maximum page size without loading pagination in memory', async () => {
    const dependencies = createVehicleDependencies();
    dependencies.vehicleRepository.count.mockResolvedValue(201);
    const listVehicles = createListVehiclesSubject(dependencies);

    const result = await listVehicles.execute({ page: '3', limit: '100' });

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith({
      filters: {},
      pagination: { skip: 200, take: 100 },
      sort: { field: 'createdAt', order: 'desc' },
    });
    expect(result.meta).toEqual({ page: 3, limit: 100, total: 201, totalPages: 3 });
  });

  it('serializes persisted decimal prices and timestamps as public API values', async () => {
    const dependencies = createVehicleDependencies();
    dependencies.vehicleRepository.findMany.mockResolvedValue([
      createPersistedVehicleFixture({ price: '3500000.55' }),
    ]);
    dependencies.vehicleRepository.count.mockResolvedValue(1);
    const listVehicles = createListVehiclesSubject(dependencies);

    const result = await listVehicles.execute({});

    expect(result.data).toEqual([createVehicleFixture({ price: 3_500_000.55 })]);
    expect(result.data[0]?.price).toBeTypeOf('number');
    expect(result.data[0]?.createdAt).toBe('2026-07-20T09:30:00.000Z');
    expect(result.data[0]?.updatedAt).toBe('2026-07-21T11:45:00.000Z');
  });

  it.each([0, -1, 1.5, 'zero', '', '1.5', '9'.repeat(400)])(
    'rejects invalid page value %j before querying the repository',
    async (page) => {
      const dependencies = createVehicleDependencies();
      const listVehicles = createListVehiclesSubject(dependencies);

      const error = await captureExpectedVehicleError(() => listVehicles.execute({ page }));

      expectValidationError(error);
      expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
      expect(dependencies.vehicleRepository.count).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 1.5, 'many', '', '2.5'])(
    'rejects invalid limit value %j before querying the repository',
    async (limit) => {
      const dependencies = createVehicleDependencies();
      const listVehicles = createListVehiclesSubject(dependencies);

      const error = await captureExpectedVehicleError(() => listVehicles.execute({ limit }));

      expectValidationError(error);
      expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
      expect(dependencies.vehicleRepository.count).not.toHaveBeenCalled();
    },
  );

  it('rejects page sizes above the maximum of 100', async () => {
    const dependencies = createVehicleDependencies();
    const listVehicles = createListVehiclesSubject(dependencies);

    const error = await captureExpectedVehicleError(() => listVehicles.execute({ limit: '101' }));

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });

  it('rejects pagination whose database offset cannot be represented safely', async () => {
    const dependencies = createVehicleDependencies();
    const listVehicles = createListVehiclesSubject(dependencies);

    const error = await captureExpectedVehicleError(() =>
      listVehicles.execute({ page: String(Number.MAX_SAFE_INTEGER), limit: '100' }),
    );

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });

  it('rejects query parameters outside the list allowlist', async () => {
    const dependencies = createVehicleDependencies();
    const listVehicles = createListVehiclesSubject(dependencies);

    const error = await captureExpectedVehicleError(() =>
      listVehicles.execute({ page: '1', role: 'ADMIN' }),
    );

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });
});
