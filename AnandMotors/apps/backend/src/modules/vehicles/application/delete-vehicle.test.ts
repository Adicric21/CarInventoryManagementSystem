import { beforeEach, describe, expect, it } from 'vitest';

import { createVehicleDependencies } from '../test-support/vehicle-doubles.js';
import { VEHICLE_ID } from '../test-support/vehicle-fixtures.js';
import { createDeleteVehicleSubject } from '../test-support/vehicle-subjects.js';
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

describe('delete vehicle', () => {
  let dependencies: ReturnType<typeof createVehicleDependencies>;
  let deleteVehicle: ReturnType<typeof createDeleteVehicleSubject>;

  beforeEach(() => {
    dependencies = createVehicleDependencies();
    deleteVehicle = createDeleteVehicleSubject(dependencies);
  });

  it('deletes an existing vehicle and returns no value', async () => {
    const result = await deleteVehicle.execute(VEHICLE_ID);

    expect(dependencies.vehicleRepository.findById).toHaveBeenCalledWith(VEHICLE_ID);
    expect(dependencies.vehicleRepository.delete).toHaveBeenCalledOnce();
    expect(dependencies.vehicleRepository.delete).toHaveBeenCalledWith(VEHICLE_ID);
    expect(result).toBeUndefined();
  });

  it('rejects an invalid vehicle id before querying persistence', async () => {
    const error = await captureExpectedVehicleError(() =>
      deleteVehicle.execute('not-a-valid-uuid'),
    );

    expect(error).toMatchObject(VALIDATION_ERROR);
    expect(dependencies.vehicleRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.vehicleRepository.delete).not.toHaveBeenCalled();
  });

  it('returns a stable not-found error when the vehicle does not exist', async () => {
    dependencies.vehicleRepository.findById.mockResolvedValue(null);

    const error = await captureExpectedVehicleError(() => deleteVehicle.execute(VEHICLE_ID));

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
    expect(dependencies.vehicleRepository.delete).not.toHaveBeenCalled();
  });

  it('returns a stable not-found error when the vehicle disappears during deletion', async () => {
    dependencies.vehicleRepository.delete.mockResolvedValue(false);

    const error = await captureExpectedVehicleError(() => deleteVehicle.execute(VEHICLE_ID));

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
  });

  it('returns not found when the same vehicle is deleted repeatedly', async () => {
    dependencies.vehicleRepository.delete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await deleteVehicle.execute(VEHICLE_ID);
    const error = await captureExpectedVehicleError(() => deleteVehicle.execute(VEHICLE_ID));

    expect(error).toMatchObject(VEHICLE_NOT_FOUND);
    expect(dependencies.vehicleRepository.delete).toHaveBeenCalledTimes(2);
  });

  it('maps repository lookup failures to a safe unexpected error', async () => {
    const sensitiveDetail = 'database lookup failure details';
    dependencies.vehicleRepository.findById.mockRejectedValue(new Error(sensitiveDetail));

    const error = await captureExpectedVehicleError(() => deleteVehicle.execute(VEHICLE_ID));

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
    expect(dependencies.vehicleRepository.delete).not.toHaveBeenCalled();
  });

  it('maps repository deletion failures to a safe unexpected error', async () => {
    const sensitiveDetail = 'database deletion failure details';
    dependencies.vehicleRepository.delete.mockRejectedValue(new Error(sensitiveDetail));

    const error = await captureExpectedVehicleError(() => deleteVehicle.execute(VEHICLE_ID));

    expect(error).toMatchObject(UNEXPECTED_ERROR);
    expect(String(error)).not.toContain(sensitiveDetail);
  });
});
