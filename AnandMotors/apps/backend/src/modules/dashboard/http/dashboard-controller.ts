import type { ApiResponse } from '../../../shared/http/error-response.js';
import { toErrorResponse } from '../../../shared/http/error-response.js';
import type { GetDashboardService } from '../application/get-dashboard.js';

export class DashboardController {
  public constructor(private readonly getDashboard: GetDashboardService) {}

  public async show(query: unknown): Promise<ApiResponse> {
    try {
      return { status: 200, body: await this.getDashboard.execute(query) };
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
