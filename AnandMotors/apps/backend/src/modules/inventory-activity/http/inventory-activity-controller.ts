import type { ApiResponse } from '../../../shared/http/error-response.js';
import { toErrorResponse } from '../../../shared/http/error-response.js';

interface ListInventoryActivities {
  execute(query: unknown): Promise<unknown>;
}

export class InventoryActivityController {
  public constructor(private readonly listInventoryActivities: ListInventoryActivities) {}

  public async list(query: unknown): Promise<ApiResponse> {
    try {
      return {
        status: 200,
        body: await this.listInventoryActivities.execute(query),
      };
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
