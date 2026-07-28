import type { ApiResponse } from '../../../shared/http/error-response.js';
import { toErrorResponse } from '../../../shared/http/error-response.js';
import type { ListPurchasesService } from '../application/list-purchases.js';

export class PurchaseController {
  public constructor(private readonly listPurchases: ListPurchasesService) {}

  public async mine(userId: string, query: unknown): Promise<ApiResponse> {
    try {
      return { status: 200, body: await this.listPurchases.forUser(userId, query) };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  public async all(query: unknown): Promise<ApiResponse> {
    try {
      return { status: 200, body: await this.listPurchases.forAdmin(query) };
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
