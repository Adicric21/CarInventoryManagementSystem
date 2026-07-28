import { beforeEach, describe, expect, it } from 'vitest';

import { createVehicleDependencies } from '../test-support/vehicle-doubles.js';
import {
  createCreateVehicleInput,
  createPersistedVehicleFixture,
  createVehicleFixture,
  VEHICLE_ID,
} from '../test-support/vehicle-fixtures.js';
import { createCreateVehicleSubject } from '../test-support/vehicle-subjects.js';
import { captureExpectedVehicleError } from '../test-support/vehicle-test-helpers.js';

const VALIDATION_ERROR = { code: 'VALIDATION_ERROR' };
const UNEXPECTED_ERROR = {
  code: 'UNEXPECTED_ERROR',
  message: 'An unexpected error occurred.',
};

function withoutField(field: string): Record<string, unknown> {
  const input: Record<string, unknown> = { ...createCreateVehicleInput() };
  Reflect.deleteProperty(input, field);
  return input;
}

describe('create vehicle', () => {
  let dependencies: ReturnType<typeof createVehicleDependencies>;
  let createVehicle: ReturnType<typeof createCreateVehicleSubject>;

  beforeEach(() => {
    dependencies = createVehicleDependencies();
    createVehicle = createCreateVehicleSubject(dependencies);
  });

  it('creates a vehicle with valid details', async () => {
    const vehicle = await createVehicle.execute(createCreateVehicleInput());

    expect(dependencies.vehicleRepository.create).toHaveBeenCalledOnce();
    expect(vehicle).toEqual(createVehicleFixture());
  });

  it('trims every text field before persistence', async () => {
    await createVehicle.execute(
      createCreateVehicleInput({
        make: '  Toyota  ',
        model: '  Fortuner  ',
        category: '  SUV  ',
      }),
    );

    expect(dependencies.vehicleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ make: 'Toyota', model: 'Fortuner', category: 'SUV' }),
    );
  });

  it('passes money to the repository as an exact decimal string', async () => {
    await createVehicle.execute(createCreateVehicleInput({ price: 3_500_000.25 }));

    expect(dependencies.vehicleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: '3500000.25' }),
    );
  });

  it('persists only editable vehicle fields', async () => {
    await createVehicle.execute(createCreateVehicleInput());

    const [persistedInput] = dependencies.vehicleRepository.create.mock.calls[0] ?? [];
    expect(persistedInput).toEqual({
      make: 'Toyota',
      model: 'Fortuner',
      category: 'SUV',
      price: '3500000',
      quantity: 5,
    });
    expect(persistedInput).not.toHaveProperty('id');
    expect(persistedInput).not.toHaveProperty('createdAt');
    expect(persistedInput).not.toHaveProperty('updatedAt');
  });

  it('returns the server-generated id and timestamps', async () => {
    const vehicle = await createVehicle.execute(createCreateVehicleInput());

    expect(vehicle.id).toBe(VEHICLE_ID);
    expect(vehicle.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(vehicle.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it('serializes repository decimals and dates for the API boundary', async () => {
    dependencies.vehicleRepository.create.mockResolvedValue(
      createPersistedVehicleFixture({
        price: '3500000.25',
        createdAt: new Date('2026-07-20T09:30:00.000Z'),
        updatedAt: new Date('2026-07-21T11:45:00.000Z'),
      }),
    );

    const vehicle = await createVehicle.execute(createCreateVehicleInput());

    expect(vehicle.price).toBe(3_500_000.25);
    expect(vehicle.createdAt).toBe('2026-07-20T09:30:00.000Z');
    expect(vehicle.updatedAt).toBe('2026-07-21T11:45:00.000Z');
  });

  it.each(['make', 'model', 'category', 'price', 'quantity'])(
    'rejects a request with missing %s',
    async (field) => {
      const error = await captureExpectedVehicleError(() =>
        createVehicle.execute(withoutField(field)),
      );

      expect(error).toMatchObject(VALIDATION_ERROR);
      expect(dependencies.vehicleRepository.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['make', '   '],
    ['model', '   '],
    ['category', '   '],
  ])('rejects a blank %s', async (field, value) => {
    const error = await captureExpectedVehicleError(() =>
      createVehicle.execute({ ...createCreateVehicleInput(), [field]: value }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.create).not.toHaveBeenCalled();
  });

  it.each(['make', 'model', 'category'])(
    'rejects a %s longer than the persistence limit',
    async (field) => {
      const error = await captureExpectedVehicleError(() =>
        createVehicle.execute({ ...createCreateVehicleInput(), [field]: 'x'.repeat(101) }),
      );

      expect(error).toMatchObject(VALIDATION_ERROR);
      expect(dependencies.vehicleRepository.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['non-numeric', '3500000'],
    ['not-a-number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['more precise than persisted money', 10.001],
    ['above the persisted decimal range', 1_000_000_000_000],
  ])('rejects a %s price', async (_description, price) => {
    const error = await captureExpectedVehicleError(() =>
      createVehicle.execute({ ...createCreateVehicleInput(), price }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['negative', -1],
    ['decimal', 1.5],
    ['non-numeric', '5'],
    ['above the persisted integer range', 2_147_483_648],
  ])('rejects a %s quantity', async (_description, quantity) => {
    const error = await captureExpectedVehicleError(() =>
      createVehicle.execute({ ...createCreateVehicleInput(), quantity }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.create).not.toHaveBeenCalled();
  });

  it('accepts zero quantity', async () => {
    await createVehicle.execute(createCreateVehicleInput({ quantity: 0 }));

    expect(dependencies.vehicleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 0 }),
    );
  });

  it('rejects unknown fields rather than passing them to persistence', async () => {
    const error = await captureExpectedVehicleError(() =>
      createVehicle.execute({ ...createCreateVehicleInput(), role: 'ADMIN' }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.create).not.toHaveBeenCalled();
  });

  it('maps repository failures to a safe unexpected error', async () => {
    const sensitiveDetail = 'database connection string leaked';
    dependencies.vehicleRepository.create.mockRejectedValue(new Error(sensitiveDetail));

    const error = await captureExpectedVehicleError(() =>
      createVehicle.execute(createCreateVehicleInput()),
    );

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
  });
});
