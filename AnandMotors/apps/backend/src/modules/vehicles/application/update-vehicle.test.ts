import { beforeEach, describe, expect, it } from 'vitest';

import { createVehicleDependencies } from '../test-support/vehicle-doubles.js';
import {
  createPersistedVehicleFixture,
  createUpdateVehicleInput,
  createVehicleFixture,
  UPDATED_AT,
  VEHICLE_ID,
} from '../test-support/vehicle-fixtures.js';
import { createUpdateVehicleSubject } from '../test-support/vehicle-subjects.js';
import { captureExpectedVehicleError } from '../test-support/vehicle-test-helpers.js';

const VALIDATION_ERROR = { code: 'VALIDATION_ERROR' };
const VEHICLE_NOT_FOUND = {
  code: 'VEHICLE_NOT_FOUND',
  message: 'Vehicle not found.',
};
const UNEXPECTED_ERROR = {
  code: 'UNEXPECTED_ERROR',
  message: 'An unexpected error occurred.',
};

describe('update vehicle', () => {
  let dependencies: ReturnType<typeof createVehicleDependencies>;
  let updateVehicle: ReturnType<typeof createUpdateVehicleSubject>;

  beforeEach(() => {
    dependencies = createVehicleDependencies();
    updateVehicle = createUpdateVehicleSubject(dependencies);
  });

  it('updates every editable field for an existing vehicle', async () => {
    dependencies.vehicleRepository.update.mockResolvedValue(
      createPersistedVehicleFixture({
        model: 'Fortuner Legender',
        price: '4200000',
        quantity: 3,
      }),
    );

    const vehicle = await updateVehicle.execute(VEHICLE_ID, createUpdateVehicleInput());

    expect(dependencies.vehicleRepository.update).toHaveBeenCalledWith(VEHICLE_ID, {
      make: 'Toyota',
      model: 'Fortuner Legender',
      category: 'SUV',
      price: '4200000',
      quantity: 3,
    });
    expect(vehicle).toEqual(
      createVehicleFixture({ model: 'Fortuner Legender', price: 4_200_000, quantity: 3 }),
    );
  });

  it('supports a partial update without overwriting omitted fields', async () => {
    dependencies.vehicleRepository.update.mockResolvedValue(
      createPersistedVehicleFixture({ quantity: 8 }),
    );

    await updateVehicle.execute(VEHICLE_ID, { quantity: 8 });

    expect(dependencies.vehicleRepository.update).toHaveBeenCalledWith(VEHICLE_ID, {
      quantity: 8,
    });
  });

  it('trims supplied text fields before persistence', async () => {
    await updateVehicle.execute(VEHICLE_ID, {
      make: '  Toyota  ',
      model: '  Fortuner  ',
      category: '  SUV  ',
    });

    expect(dependencies.vehicleRepository.update).toHaveBeenCalledWith(VEHICLE_ID, {
      make: 'Toyota',
      model: 'Fortuner',
      category: 'SUV',
    });
  });

  it('passes an updated price to persistence as an exact decimal string', async () => {
    await updateVehicle.execute(VEHICLE_ID, { price: 4_200_000.25 });

    expect(dependencies.vehicleRepository.update).toHaveBeenCalledWith(VEHICLE_ID, {
      price: '4200000.25',
    });
  });

  it('checks that the vehicle exists before updating it', async () => {
    await updateVehicle.execute(VEHICLE_ID, { quantity: 8 });

    expect(dependencies.vehicleRepository.findById).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.findById).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it('returns API-safe decimal and timestamp values', async () => {
    dependencies.vehicleRepository.update.mockResolvedValue(
      createPersistedVehicleFixture({ price: '4200000.25' }),
    );

    const vehicle = await updateVehicle.execute(VEHICLE_ID, { price: 4_200_000.25 });

    expect(vehicle.price).toBe(4_200_000.25);
    expect(vehicle.createdAt).toEqual(expect.any(String));
    expect(vehicle.updatedAt).toBe(UPDATED_AT);
  });

  it('rejects an invalid vehicle id before querying persistence', async () => {
    const error = await captureExpectedVehicleError(() =>
      updateVehicle.execute('not-a-uuid', { quantity: 8 }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it('returns a stable not-found error when the vehicle does not exist', async () => {
    dependencies.vehicleRepository.findById.mockResolvedValue(null);

    const error = await captureExpectedVehicleError(() =>
      updateVehicle.execute(VEHICLE_ID, { quantity: 8 }),
    );

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it('returns a stable not-found error when the vehicle disappears during update', async () => {
    dependencies.vehicleRepository.update.mockResolvedValue(null);

    const error = await captureExpectedVehicleError(() =>
      updateVehicle.execute(VEHICLE_ID, { quantity: 8 }),
    );

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
  });

  it.each([
    ['make', '   '],
    ['model', '   '],
    ['category', '   '],
    ['price', 0],
    ['price', -1],
    ['price', '4200000'],
    ['price', 10.001],
    ['price', 1_000_000_000_000],
    ['quantity', -1],
    ['quantity', 1.5],
    ['quantity', '3'],
    ['quantity', 2_147_483_648],
    ['make', 'x'.repeat(101)],
  ])('rejects invalid update field %s with value %s', async (field, value) => {
    const error = await captureExpectedVehicleError(() =>
      updateVehicle.execute(VEHICLE_ID, { [field]: value }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it('rejects an empty update body', async () => {
    const error = await captureExpectedVehicleError(() => updateVehicle.execute(VEHICLE_ID, {}));

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it.each(['id', 'createdAt', 'updatedAt', 'role'])(
    'rejects the non-editable or unknown %s field',
    async (field) => {
      const error = await captureExpectedVehicleError(() =>
        updateVehicle.execute(VEHICLE_ID, { [field]: 'client-controlled' }),
      );

      expect(error).toMatchObject(VALIDATION_ERROR);
      expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
    },
  );

  it('maps repository lookup failures to a safe unexpected error', async () => {
    const sensitiveDetail = 'Prisma lookup details';
    dependencies.vehicleRepository.findById.mockRejectedValue(new Error(sensitiveDetail));

    const error = await captureExpectedVehicleError(() =>
      updateVehicle.execute(VEHICLE_ID, { quantity: 8 }),
    );

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it('maps repository update failures to a safe unexpected error', async () => {
    const sensitiveDetail = 'Prisma update details';
    dependencies.vehicleRepository.update.mockRejectedValue(new Error(sensitiveDetail));

    const error = await captureExpectedVehicleError(() =>
      updateVehicle.execute(VEHICLE_ID, { quantity: 8 }),
    );

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
  });
});
