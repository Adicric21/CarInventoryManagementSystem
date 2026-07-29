import { beforeEach, describe, expect, it } from 'vitest';

import {
  VEHICLE_SORT_FIELDS,
  type FindVehiclesQuery,
  type SortOrder,
  type VehicleSortField,
} from '../test-support/vehicle-contracts.js';
import { createVehicleDependencies } from '../test-support/vehicle-doubles.js';
import {
  createPersistedVehicleFixture,
  createVehicleFixture,
} from '../test-support/vehicle-fixtures.js';
import { createSearchVehiclesSubject } from '../test-support/vehicle-subjects.js';
import { captureExpectedVehicleError } from '../test-support/vehicle-test-helpers.js';

const DEFAULT_REPOSITORY_QUERY = {
  filters: {},
  pagination: { skip: 0, take: 10 },
  sort: { field: 'createdAt', order: 'desc' },
} satisfies FindVehiclesQuery;

const SORT_CASES = VEHICLE_SORT_FIELDS.flatMap((field) =>
  (['asc', 'desc'] as const).map((order) => [field, order] as const),
);

function expectValidationError(error: unknown): void {
  expect(error).toMatchObject({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'The request is invalid.',
  });
}

describe('search vehicles', () => {
  let dependencies: ReturnType<typeof createVehicleDependencies>;
  let searchVehicles: ReturnType<typeof createSearchVehiclesSubject>;

  beforeEach(() => {
    dependencies = createVehicleDependencies();
    searchVehicles = createSearchVehiclesSubject(dependencies);
  });

  it('uses deterministic pagination and sorting defaults', async () => {
    const result = await searchVehicles.execute({});

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(DEFAULT_REPOSITORY_QUERY);
    expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith({});
    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it.each(['make', 'model', 'category'] as const)(
    'trims the %s filter and delegates text matching to the repository',
    async (field) => {
      await searchVehicles.execute({ [field]: '  ToYoTa  ' });

      const expectedFilters = { [field]: 'ToYoTa' };
      expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith({
        filters: expectedFilters,
        pagination: { skip: 0, take: 10 },
        sort: { field: 'createdAt', order: 'desc' },
      });
      expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith(expectedFilters);
    },
  );

  it('preserves text-filter casing so the repository can apply case-insensitive matching', async () => {
    await searchVehicles.execute({ make: 'tOyOtA', model: 'fOrTuNeR', category: 'sUv' });

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { make: 'tOyOtA', model: 'fOrTuNeR', category: 'sUv' },
      }),
    );
  });

  it.each([
    ['minPrice', '1250000.25'],
    ['maxPrice', '4500000.75'],
  ] as const)(
    'passes a valid %s decimal filter without floating-point conversion',
    async (field, value) => {
      await searchVehicles.execute({ [field]: value });

      expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ filters: { [field]: value } }),
      );
      expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith({ [field]: value });
    },
  );

  it('combines minimum and maximum price filters', async () => {
    await searchVehicles.execute({ minPrice: '1250000.25', maxPrice: '4500000.75' });

    const filters = { minPrice: '1250000.25', maxPrice: '4500000.75' };
    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters }),
    );
    expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith(filters);
  });

  it.each([
    ['true', true],
    ['false', false],
  ] as const)('safely parses inStock=%s as %s', async (input, expected) => {
    await searchVehicles.execute({ inStock: input });

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { inStock: expected } }),
    );
    expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith({ inStock: expected });
  });

  it('passes multiple filters, pagination, and sorting as one database query', async () => {
    dependencies.vehicleRepository.count.mockResolvedValue(23);

    const result = await searchVehicles.execute({
      make: '  Toyota ',
      model: ' Fortuner  ',
      category: ' SUV ',
      minPrice: '3000000.50',
      maxPrice: '4000000.75',
      inStock: 'true',
      page: '2',
      limit: '5',
      sortBy: 'price',
      sortOrder: 'asc',
    });

    const filters = {
      make: 'Toyota',
      model: 'Fortuner',
      category: 'SUV',
      minPrice: '3000000.50',
      maxPrice: '4000000.75',
      inStock: true,
    };
    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith({
      filters,
      pagination: { skip: 5, take: 5 },
      sort: { field: 'price', order: 'asc' },
    });
    expect(dependencies.vehicleRepository.count).toHaveBeenCalledWith(filters);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 23, totalPages: 5 });
  });

  it('returns an empty result page when no vehicle matches', async () => {
    const result = await searchVehicles.execute({ make: 'Nonexistent' });

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('serializes matching vehicles without exposing persisted decimal or Date objects', async () => {
    dependencies.vehicleRepository.findMany.mockResolvedValue([
      createPersistedVehicleFixture({ price: '3500000.55' }),
    ]);
    dependencies.vehicleRepository.count.mockResolvedValue(1);

    const result = await searchVehicles.execute({ make: 'Toyota' });

    expect(result.data).toEqual([createVehicleFixture({ price: 3_500_000.55 })]);
    expect(result.data[0]?.price).toBeTypeOf('number');
    expect(result.data[0]?.createdAt).toBeTypeOf('string');
    expect(result.data[0]?.updatedAt).toBeTypeOf('string');
  });

  it('supports paginating search results in the repository', async () => {
    dependencies.vehicleRepository.count.mockResolvedValue(41);

    const result = await searchVehicles.execute({ page: '3', limit: '20' });

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith({
      filters: {},
      pagination: { skip: 40, take: 20 },
      sort: { field: 'createdAt', order: 'desc' },
    });
    expect(result.meta).toEqual({ page: 3, limit: 20, total: 41, totalPages: 3 });
  });

  it('rejects pagination whose database offset cannot be represented safely', async () => {
    const error = await captureExpectedVehicleError(() =>
      searchVehicles.execute({ page: String(Number.MAX_SAFE_INTEGER), limit: '100' }),
    );

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });

  it.each(SORT_CASES)(
    'allows sorting by %s in %s order',
    async (field: VehicleSortField, order: SortOrder) => {
      await searchVehicles.execute({ sortBy: field, sortOrder: order });

      expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ sort: { field, order } }),
      );
    },
  );

  it.each(['id', 'updatedAt', 'seller', 'price; DROP TABLE Vehicle'])(
    'rejects unsupported sort field %j',
    async (sortBy) => {
      const error = await captureExpectedVehicleError(() => searchVehicles.execute({ sortBy }));

      expectValidationError(error);
      expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
    },
  );

  it.each(['ascending', 'DESC', 'sideways', 'asc; DROP TABLE Vehicle'])(
    'rejects unsupported sort order %j',
    async (sortOrder) => {
      const error = await captureExpectedVehicleError(() => searchVehicles.execute({ sortOrder }));

      expectValidationError(error);
      expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['minPrice', '-1'],
    ['minPrice', 'not-a-price'],
    ['minPrice', ''],
    ['maxPrice', '-1'],
    ['maxPrice', 'not-a-price'],
    ['maxPrice', ''],
  ] as const)('rejects invalid %s value %j', async (field, value) => {
    const error = await captureExpectedVehicleError(() =>
      searchVehicles.execute({ [field]: value }),
    );

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });

  it('rejects a minimum price greater than the maximum price', async () => {
    const error = await captureExpectedVehicleError(() =>
      searchVehicles.execute({ minPrice: '4000000.01', maxPrice: '4000000.00' }),
    );

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });

  it.each(['yes', '1', 'TRUE', 'on'])('rejects unsafe inStock value %j', async (inStock) => {
    const error = await captureExpectedVehicleError(() => searchVehicles.execute({ inStock }));

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });

  it('treats SQL-like text as a literal structured filter value', async () => {
    const make = "Toyota' OR 1=1 --";

    await searchVehicles.execute({ make });

    expect(dependencies.vehicleRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { make } }),
    );
  });

  it('rejects query parameters outside the search allowlist', async () => {
    const error = await captureExpectedVehicleError(() =>
      searchVehicles.execute({ make: 'Toyota', role: 'ADMIN' }),
    );

    expectValidationError(error);
    expect(dependencies.vehicleRepository.findMany).not.toHaveBeenCalled();
  });
});
