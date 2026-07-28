import { type Prisma, type Purchase as PrismaPurchase } from '../../../generated/prisma/client.js';
import type {
  FindPurchasesQuery,
  PurchaseFilters,
  PurchaseRepository,
} from '../domain/purchase-repository.js';
import type { PersistedPurchase } from '../domain/purchase-types.js';

const userSelection = { id: true, name: true, email: true } as const;
type PrismaPurchaseWithUser = PrismaPurchase & {
  user: { id: string; name: string; email: string };
};

interface PurchaseDelegate {
  findMany(input: {
    where: Prisma.PurchaseWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.PurchaseOrderByWithRelationInput[];
    include: { user: { select: typeof userSelection } };
  }): Promise<PrismaPurchaseWithUser[]>;
  count(input: { where: Prisma.PurchaseWhereInput }): Promise<number>;
}

function whereFrom(filters: PurchaseFilters): Prisma.PurchaseWhereInput {
  return {
    ...(filters.userId === undefined ? {} : { userId: filters.userId }),
    ...(filters.vehicleId === undefined ? {} : { vehicleId: filters.vehicleId }),
    ...(filters.make === undefined
      ? {}
      : { vehicleMake: { contains: filters.make, mode: 'insensitive' as const } }),
    ...(filters.model === undefined
      ? {}
      : { vehicleModel: { contains: filters.model, mode: 'insensitive' as const } }),
    ...(filters.from === undefined && filters.to === undefined
      ? {}
      : {
          purchasedAt: {
            ...(filters.from === undefined ? {} : { gte: filters.from }),
            ...(filters.to === undefined ? {} : { lte: filters.to }),
          },
        }),
  };
}

function toPersisted(purchase: PrismaPurchaseWithUser): PersistedPurchase {
  return {
    id: purchase.id,
    vehicleId: purchase.vehicleId,
    vehicleMake: purchase.vehicleMake,
    vehicleModel: purchase.vehicleModel,
    vehicleCategory: purchase.vehicleCategory,
    unitPrice: purchase.unitPrice.toFixed(2),
    quantity: purchase.quantity,
    totalAmount: purchase.totalAmount.toFixed(2),
    purchasedAt: purchase.purchasedAt,
    purchasedBy: purchase.user,
  };
}

export class PrismaPurchaseRepository implements PurchaseRepository {
  public constructor(private readonly purchases: PurchaseDelegate) {}

  public async findMany(query: FindPurchasesQuery): Promise<PersistedPurchase[]> {
    const purchases = await this.purchases.findMany({
      where: whereFrom(query.filters),
      skip: query.pagination.skip,
      take: query.pagination.take,
      orderBy: [{ purchasedAt: query.sortOrder }, { id: query.sortOrder }],
      include: { user: { select: userSelection } },
    });
    return purchases.map(toPersisted);
  }

  public count(filters: PurchaseFilters): Promise<number> {
    return this.purchases.count({ where: whereFrom(filters) });
  }
}
