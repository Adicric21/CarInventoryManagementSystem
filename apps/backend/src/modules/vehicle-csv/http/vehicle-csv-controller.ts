import type { ApiResponse } from '../../../shared/http/error-response.js';
import { toErrorResponse } from '../../../shared/http/error-response.js';
import type { VehicleCsvService } from '../application/vehicle-csv.js';

export class VehicleCsvController {
  public constructor(private readonly service: VehicleCsvService) {}

  public preview(buffer: Buffer): ApiResponse {
    try {
      return { status: 200, body: this.service.preview(buffer) };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  public async import(buffer: Buffer, performedById: string): Promise<ApiResponse> {
    try {
      return { status: 200, body: await this.service.import(buffer, performedById) };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  public async export(): Promise<ApiResponse> {
    try {
      return { status: 200, body: await this.service.export() };
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
