import { ApiError, type ErrorDetails } from '../../../shared/http/api-error.js';

export const VEHICLE_ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  notFound: 'VEHICLE_NOT_FOUND',
  insufficientStock: 'INSUFFICIENT_STOCK',
  unexpected: 'UNEXPECTED_ERROR',
} as const;

export type VehicleErrorCode = (typeof VEHICLE_ERROR_CODES)[keyof typeof VEHICLE_ERROR_CODES];

export class VehicleError extends ApiError<VehicleErrorCode> {
  constructor(status: number, code: VehicleErrorCode, message: string, details: ErrorDetails = {}) {
    super(status, code, message, details);
    this.name = 'VehicleError';
  }
}

export function vehicleValidationError(details: ErrorDetails): VehicleError {
  return new VehicleError(400, VEHICLE_ERROR_CODES.validation, 'The request is invalid.', details);
}

export function vehicleNotFoundError(): VehicleError {
  return new VehicleError(404, VEHICLE_ERROR_CODES.notFound, 'Vehicle not found.');
}

export function insufficientStockError(): VehicleError {
  return new VehicleError(
    409,
    VEHICLE_ERROR_CODES.insufficientStock,
    'Requested quantity exceeds available stock.',
  );
}

export function unexpectedVehicleError(): VehicleError {
  return new VehicleError(500, VEHICLE_ERROR_CODES.unexpected, 'An unexpected error occurred.');
}
