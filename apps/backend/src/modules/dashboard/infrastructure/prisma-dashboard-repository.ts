import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { toInventoryActivity } from '../../inventory-activity/domain/inventory-activity-types.js';
import type { DashboardQuery, DashboardRepository } from '../domain/dashboard-repository.js';
import type { DashboardData } from '../domain/dashboard-types.js';

interface DecimalTotalRow {
  value: Prisma.Decimal;
}

interface DailyPurchaseRow {
  date: string;
  purchaseCount: number;
  unitsPurchased: number;
  revenue: Prisma.Decimal;
}

export class PrismaDashboardRepository implements DashboardRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getDashboard({ from, lowStockThreshold }: DashboardQuery): Promise<DashboardData> {
    const [
      vehicleTotals,
      inventoryValueRows,
      lowStockCount,
      outOfStockCount,
      categories,
      purchaseTotals,
      purchasesByDay,
      topVehicles,
      recentActivities,
    ] = await Promise.all([
      this.prisma.vehicle.aggregate({
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      // Prisma cannot aggregate a product or group timestamps by UTC day. Both queries are
      // static Prisma.sql templates; the only runtime value is safely parameterized.
      this.prisma.$queryRaw<DecimalTotalRow[]>(Prisma.sql`
        SELECT COALESCE(SUM("price" * "quantity"), 0)::numeric AS "value"
        FROM "vehicles"
      `),
      this.prisma.vehicle.count({
        where: { quantity: { gt: 0, lte: lowStockThreshold } },
      }),
      this.prisma.vehicle.count({ where: { quantity: 0 } }),
      this.prisma.vehicle.groupBy({
        by: ['category'],
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.purchase.aggregate({
        where: { purchasedAt: { gte: from } },
        _count: { _all: true },
        _sum: { quantity: true, totalAmount: true },
      }),
      this.prisma.$queryRaw<DailyPurchaseRow[]>(Prisma.sql`
        SELECT
          TO_CHAR("purchased_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "date",
          COUNT(*)::integer AS "purchaseCount",
          COALESCE(SUM("quantity"), 0)::integer AS "unitsPurchased",
          COALESCE(SUM("total_amount"), 0)::numeric AS "revenue"
        FROM "purchases"
        WHERE "purchased_at" >= ${from}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      this.prisma.purchase.groupBy({
        by: ['vehicleMake', 'vehicleModel'],
        where: { purchasedAt: { gte: from } },
        _sum: { quantity: true, totalAmount: true },
        orderBy: [{ _sum: { quantity: 'desc' } }, { vehicleMake: 'asc' }],
        take: 5,
      }),
      this.prisma.inventoryActivity.findMany({
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          performedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return {
      summary: {
        vehicleCount: vehicleTotals._count._all,
        totalStockUnits: vehicleTotals._sum.quantity ?? 0,
        inventoryValue: (inventoryValueRows[0]?.value ?? new Prisma.Decimal(0)).toFixed(2),
        lowStockCount,
        outOfStockCount,
        purchaseCount: purchaseTotals._count._all,
        unitsPurchased: purchaseTotals._sum.quantity ?? 0,
        purchaseRevenue: (purchaseTotals._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
      },
      vehiclesByCategory: categories.map((category) => ({
        category: category.category,
        vehicleCount: category._count._all,
        stockUnits: category._sum.quantity ?? 0,
      })),
      purchasesByDay: purchasesByDay.map((day) => ({
        ...day,
        revenue: day.revenue.toFixed(2),
      })),
      topPurchasedVehicles: topVehicles.map((vehicle) => ({
        vehicleMake: vehicle.vehicleMake,
        vehicleModel: vehicle.vehicleModel,
        unitsPurchased: vehicle._sum.quantity ?? 0,
        revenue: (vehicle._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
      })),
      recentActivities: recentActivities.map(toInventoryActivity),
    };
  }
}
