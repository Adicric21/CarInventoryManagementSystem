import { beforeEach, describe, expect, it } from 'vitest';

import { createInventoryDependencies } from '../test-support/inventory-doubles.js';
import { createPurchaseVehicleSubject } from '../test-support/inventory-subjects.js';
import { captureExpectedInventoryError } from '../test-support/inventory-test-helpers.js';
import {
  createPersistedVehicleFixture,
  createVehicleFixture,
  VEHICLE_ID,
} from '../test-support/vehicle-fixtures.js';

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
const INSUFFICIENT_STOCK = {
  status: 409,
  code: 'INSUFFICIENT_STOCK',
  message: 'Requested quantity exceeds available stock.',
};
const UNEXPECTED_ERROR = {
  status: 500,
  code: 'UNEXPECTED_ERROR',
  message: 'An unexpected error occurred.',
};

describe('purchase vehicle', () => {
  let dependencies: ReturnType<typeof createInventoryDependencies>;
  let purchaseVehicle: ReturnType<typeof createPurchaseVehicleSubject>;

  beforeEach(() => {
    dependencies = createInventoryDependencies();
    purchaseVehicle = createPurchaseVehicleSubject(dependencies);
  });

  it('purchases one vehicle atomically and returns the updated public vehicle', async () => {
    const vehicle = await purchaseVehicle.execute(VEHICLE_ID, { quantity: 1 });

    expect(dependencies.vehicleRepository.purchaseWithActivity).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.purchaseWithActivity).toHaveBeenCalledWith(
      VEHICLE_ID,
      1,
      '',
    );
    expect(dependencies.vehicleRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
    expect(vehicle).toEqual(createVehicleFixture({ quantity: 4 }));
  });

  it('purchases multiple units and decreases stock by the requested quantity', async () => {
    const vehicle = await purchaseVehicle.execute(VEHICLE_ID, { quantity: 3 });

    expect(dependencies.vehicleRepository.purchaseWithActivity).toHaveBeenCalledWith(
      VEHICLE_ID,
      3,
      '',
    );
    expect(vehicle.quantity).toBe(2);
  });

  it('allows purchasing the final available units without making stock negative', async () => {
    dependencies.vehicleRepository.purchaseWithActivity.mockResolvedValue({
      outcome: 'updated',
      vehicle: createPersistedVehicleFixture({ quantity: 0 }),
    });

    const vehicle = await purchaseVehicle.execute(VEHICLE_ID, { quantity: 5 });

    expect(vehicle).toEqual(createVehicleFixture({ quantity: 0 }));
    expect(vehicle.quantity).toBeGreaterThanOrEqual(0);
  });

  it('maps a purchase above available stock to the stable conflict error', async () => {
    dependencies.vehicleRepository.purchaseWithActivity.mockResolvedValue({
      outcome: 'insufficientStock',
    });

    const error = await captureExpectedInventoryError(() =>
      purchaseVehicle.execute(VEHICLE_ID, { quantity: 6 }),
    );

    expect(error).toMatchObject(INSUFFICIENT_STOCK);
    expect(dependencies.vehicleRepository.purchaseWithActivity).toHaveBeenCalledWith(
      VEHICLE_ID,
      6,
      '',
    );
    expect(dependencies.vehicleRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it('rejects a purchase when the vehicle has zero stock', async () => {
    dependencies.vehicleRepository.purchaseWithActivity.mockResolvedValue({
      outcome: 'insufficientStock',
    });

    const error = await captureExpectedInventoryError(() =>
      purchaseVehicle.execute(VEHICLE_ID, { quantity: 1 }),
    );

    expect(error).toMatchObject(INSUFFICIENT_STOCK);
    expect(dependencies.vehicleRepository.update).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['decimal', 1.5],
  ])('rejects a %s purchase quantity before calling persistence', async (_case, quantity) => {
    const error = await captureExpectedInventoryError(() =>
      purchaseVehicle.execute(VEHICLE_ID, { quantity }),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.purchaseWithActivity).not.toHaveBeenCalled();
  });

  it('maps a missing vehicle result to the stable not-found error', async () => {
    dependencies.vehicleRepository.purchaseWithActivity.mockResolvedValue({ outcome: 'notFound' });

    const error = await captureExpectedInventoryError(() =>
      purchaseVehicle.execute(VEHICLE_ID, { quantity: 1 }),
    );

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
  });

  it('maps repository failures through the shared safe unexpected-error mechanism', async () => {
    const sensitiveDetail = 'database transaction and credentials must remain internal';
    dependencies.vehicleRepository.purchaseWithActivity.mockRejectedValue(
      new Error(sensitiveDetail),
    );

    const error = await captureExpectedInventoryError(() =>
      purchaseVehicle.execute(VEHICLE_ID, { quantity: 1 }),
    );

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
  });
});
