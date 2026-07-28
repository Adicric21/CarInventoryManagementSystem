import { VehicleError, unexpectedVehicleError } from '../../vehicles/domain/vehicle-errors.js';
import type { InventoryActivityDependencies } from '../domain/inventory-activity-repository.js';
import {
  toInventoryActivity,
  type InventoryActivityPage,
} from '../domain/inventory-activity-types.js';
import { parseInventoryActivityQuery } from './inventory-activity-validation.js';

export class ListInventoryActivitiesService {
  public constructor(private readonly dependencies: InventoryActivityDependencies) {}

  public async execute(query: unknown): Promise<InventoryActivityPage> {
    const parsed = parseInventoryActivityQuery(query);
    const filters = {
      ...(parsed.action === undefined ? {} : { action: parsed.action }),
      ...(parsed.vehicleId === undefined ? {} : { vehicleId: parsed.vehicleId }),
      ...(parsed.performedById === undefined ? {} : { performedById: parsed.performedById }),
      ...(parsed.from === undefined ? {} : { from: parsed.from }),
      ...(parsed.to === undefined ? {} : { to: parsed.to }),
    };

    try {
      const [activities, total] = await Promise.all([
        this.dependencies.inventoryActivityRepository.findMany({
          filters,
          pagination: {
            skip: (parsed.page - 1) * parsed.limit,
            take: parsed.limit,
          },
          sortOrder: parsed.sortOrder,
        }),
        this.dependencies.inventoryActivityRepository.count(filters),
      ]);

      return {
        data: activities.map(toInventoryActivity),
        meta: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          totalPages: Math.ceil(total / parsed.limit),
        },
      };
    } catch (error) {
      if (error instanceof VehicleError) {
        throw error;
      }

      throw unexpectedVehicleError();
    }
  }
}
