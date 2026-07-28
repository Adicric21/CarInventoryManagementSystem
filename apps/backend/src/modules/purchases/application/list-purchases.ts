import { VehicleError, unexpectedVehicleError } from '../../vehicles/domain/vehicle-errors.js';
import type { PurchaseDependencies, PurchaseFilters } from '../domain/purchase-repository.js';
import { toPurchase, type PurchasePage } from '../domain/purchase-types.js';
import { parseAdminPurchaseQuery, parsePersonalPurchaseQuery } from './purchase-validation.js';

function filtersFrom(query: {
  userId?: string | undefined;
  vehicleId?: string | undefined;
  make?: string | undefined;
  model?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}): PurchaseFilters {
  return {
    ...(query.userId === undefined ? {} : { userId: query.userId }),
    ...(query.vehicleId === undefined ? {} : { vehicleId: query.vehicleId }),
    ...(query.make === undefined ? {} : { make: query.make }),
    ...(query.model === undefined ? {} : { model: query.model }),
    ...(query.from === undefined ? {} : { from: query.from }),
    ...(query.to === undefined ? {} : { to: query.to }),
  };
}

export class ListPurchasesService {
  public constructor(private readonly dependencies: PurchaseDependencies) {}

  public async forUser(userId: string, query: unknown): Promise<PurchasePage> {
    const parsed = parsePersonalPurchaseQuery(query);
    return await this.load({ ...parsed, userId });
  }

  public async forAdmin(query: unknown): Promise<PurchasePage> {
    return await this.load(parseAdminPurchaseQuery(query));
  }

  private async load(query: ReturnType<typeof parseAdminPurchaseQuery>): Promise<PurchasePage> {
    const filters = filtersFrom(query);
    try {
      const [purchases, total] = await Promise.all([
        this.dependencies.purchaseRepository.findMany({
          filters,
          pagination: { skip: (query.page - 1) * query.limit, take: query.limit },
          sortOrder: query.sortOrder,
        }),
        this.dependencies.purchaseRepository.count(filters),
      ]);
      return {
        data: purchases.map(toPurchase),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
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
