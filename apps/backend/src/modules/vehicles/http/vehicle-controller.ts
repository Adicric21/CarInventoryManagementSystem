import type { ApiResponse } from '../../../shared/http/error-response.js';
import { toErrorResponse } from '../../../shared/http/error-response.js';

interface CreateVehicleOperation {
  execute(input: unknown, performedById: string): Promise<unknown>;
}

interface QueryVehiclesOperation {
  execute(query: unknown): Promise<unknown>;
}

interface UpdateVehicleOperation {
  execute(id: string, input: unknown, performedById: string): Promise<unknown>;
}

interface InventoryOperation {
  execute(id: string, input: unknown, performedById: string): Promise<unknown>;
}

interface DeleteVehicleOperation {
  execute(id: string, performedById: string): Promise<void>;
}

export interface VehicleControllerDependencies {
  createVehicle: CreateVehicleOperation;
  listVehicles: QueryVehiclesOperation;
  searchVehicles: QueryVehiclesOperation;
  listLowStockVehicles: QueryVehiclesOperation;
  updateVehicle: UpdateVehicleOperation;
  deleteVehicle: DeleteVehicleOperation;
  purchaseVehicle: InventoryOperation;
  restockVehicle: InventoryOperation;
}

export class VehicleController {
  constructor(private readonly operations: VehicleControllerDependencies) {}

  async create(body: unknown, performedById: string): Promise<ApiResponse> {
    try {
      const vehicle = await this.operations.createVehicle.execute(body, performedById);
      return { status: 201, body: { data: { vehicle } } };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async list(query: unknown): Promise<ApiResponse> {
    try {
      const page = await this.operations.listVehicles.execute(query);
      return { status: 200, body: page };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async search(query: unknown): Promise<ApiResponse> {
    try {
      const page = await this.operations.searchVehicles.execute(query);
      return { status: 200, body: page };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async lowStock(query: unknown): Promise<ApiResponse> {
    try {
      const page = await this.operations.listLowStockVehicles.execute(query);
      return { status: 200, body: page };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async update(id: string, body: unknown, performedById: string): Promise<ApiResponse> {
    try {
      const vehicle = await this.operations.updateVehicle.execute(id, body, performedById);
      return { status: 200, body: { data: { vehicle } } };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async purchase(id: string, body: unknown, performedById: string): Promise<ApiResponse> {
    try {
      const vehicle = await this.operations.purchaseVehicle.execute(id, body, performedById);
      return { status: 200, body: { data: vehicle } };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async restock(id: string, body: unknown, performedById: string): Promise<ApiResponse> {
    try {
      const vehicle = await this.operations.restockVehicle.execute(id, body, performedById);
      return { status: 200, body: { data: vehicle } };
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  async delete(id: string, performedById: string): Promise<ApiResponse> {
    try {
      await this.operations.deleteVehicle.execute(id, performedById);
      return { status: 204, body: undefined };
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
