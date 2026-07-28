import { ApiError, type ErrorDetails } from '../../../shared/http/api-error.js';

export type VehicleCsvErrorCode =
  | 'CSV_FILE_REQUIRED'
  | 'CSV_FILE_TOO_LARGE'
  | 'CSV_INVALID_HEADERS'
  | 'CSV_INVALID_ROWS'
  | 'CSV_ROW_LIMIT_EXCEEDED';

export class VehicleCsvError extends ApiError<VehicleCsvErrorCode> {
  public constructor(code: VehicleCsvErrorCode, message: string, details: ErrorDetails = {}) {
    super(400, code, message, details);
    this.name = 'VehicleCsvError';
  }
}
