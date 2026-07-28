import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { CreateVehicleData } from '../../vehicles/domain/vehicle-repository.js';
import type { BulkVehicleRepository, ExportVehicle } from '../domain/bulk-vehicle-repository.js';

export class PrismaBulkVehicleRepository implements BulkVehicleRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public importWithActivities(inputs: CreateVehicleData[], performedById: string): Promise<number> {
    return this.prisma.$transaction(
      async (transaction) => {
        for (const input of inputs) {
          const vehicle = await transaction.vehicle.create({ data: input });
          await transaction.inventoryActivity.create({
            data: {
              action: 'VEHICLE_CREATED',
              vehicle: { connect: { id: vehicle.id } },
              vehicleMake: vehicle.make,
              vehicleModel: vehicle.model,
              vehicleCategory: vehicle.category,
              quantityBefore: null,
              quantityChange: vehicle.quantity,
              quantityAfter: vehicle.quantity,
              performedBy: { connect: { id: performedById } },
              metadata: { source: 'CSV_IMPORT' },
            },
          });
        }
        return inputs.length;
      },
      { timeout: 30_000 },
    );
  }

  public async findAllForExport(): Promise<ExportVehicle[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      orderBy: [{ make: 'asc' }, { model: 'asc' }, { category: 'asc' }, { id: 'asc' }],
      select: { make: true, model: true, category: true, price: true, quantity: true },
    });
    return vehicles.map((vehicle) => ({ ...vehicle, price: vehicle.price.toFixed(2) }));
  }
}
