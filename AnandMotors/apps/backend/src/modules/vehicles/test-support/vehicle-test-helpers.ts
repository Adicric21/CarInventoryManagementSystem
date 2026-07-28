import { MissingVehicleBehaviourError } from './vehicle-subjects.js';

export async function captureExpectedVehicleError(
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof MissingVehicleBehaviourError) {
      throw error;
    }

    return error;
  }

  throw new Error('Expected the vehicle operation to fail');
}
