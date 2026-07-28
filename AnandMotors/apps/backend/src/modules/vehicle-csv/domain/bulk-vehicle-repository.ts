import type { CreateVehicleData } from '../../vehicles/domain/vehicle-repository.js';

export interface ExportVehicle {
  make: string;
  model: string;
  category: string;
  price: string;
  quantity: number;
}

export interface BulkVehicleRepository {
  importWithActivities(inputs: CreateVehicleData[], performedById: string): Promise<number>;
  findAllForExport(): Promise<ExportVehicle[]>;
}
