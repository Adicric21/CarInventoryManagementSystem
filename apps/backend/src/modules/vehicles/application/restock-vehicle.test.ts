import { beforeEach, describe, expect, it } from 'vitest';

import { createInventoryDependencies } from '../test-support/inventory-doubles.js';
import { createRestockVehicleSubject } from '../test-support/inventory-subjects.js';
import { captureExpectedInventoryError } from '../test-support/inventory-test-helpers.js';
import { createVehicleFixture, VEHICLE_ID } from '../test-support/vehicle-fixtures.js';

const VALIDATION_ERROR = {
  status: 400,
  code: 'VALIDATION_ERROR',
  message: 'The request is invalid.',
};
const VEHICLE_NOT_FOUND = {
  status: 404,
  code: 'VEHICLE_NOT_FOUND',
  message: 'Vehicle not found.',
};
const UNEXPECTED_ERROR = {
  status: 500,
  code: 'UNEXPECTED_ERROR',
  message: 'An unexpected error occurred.',
};

describe('restock vehicle', () => {
  let dependencies: ReturnType<typeof createInventoryDependencies>;
  let restockVehicle: ReturnType<typeof createRestockVehicleSubject>;

  beforeEach(() => {
    dependencies = createInventoryDependencies();
    restockVehicle = createRestockVehicleSubject(dependencies);
  });

  it('restocks an existing vehicle atomically and returns the updated public vehicle', async () => {
    const vehicle = await restockVehicle.execute(VEHICLE_ID, { quantity: 3 });

    expect(dependencies.vehicleRepository.restockAtomic).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.restockAtomic).toHaveBeenCalledWith(VEHICLE_ID, 3);
    expect(dependencies.vehicleRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
    expect(vehicle).toEqual(createVehicleFixture({ quantity: 8 }));
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['decimal', 1.5],
  ])('rejects a %s restock quantity before calling persistence', async (_case, quantity) => {
    const error = await captureExpectedInventoryError(() =>
      restockVehicle.execute(VEHICLE_ID, { quantity }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.restockAtomic).not.toHaveBeenCalled();
  });

  it('maps a missing vehicle result to the stable not-found error', async () => {
    dependencies.vehicleRepository.restockAtomic.mockResolvedValue(null);

    const error = await captureExpectedInventoryError(() =>
      restockVehicle.execute(VEHICLE_ID, { quantity: 2 }),
    );

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
  });

  it('maps repository failures through the shared safe unexpected-error mechanism', async () => {
    const sensitiveDetail = 'database increment details must remain internal';
    dependencies.vehicleRepository.restockAtomic.mockRejectedValue(new Error(sensitiveDetail));

    const error = await captureExpectedInventoryError(() =>
      restockVehicle.execute(VEHICLE_ID, { quantity: 2 }),
    );

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
  });
});
