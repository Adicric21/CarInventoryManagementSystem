import type { InventoryActivity } from '../../inventory-activity/domain/inventory-activity-types.js';

export type DashboardPeriod = '7d' | '30d' | '90d';

export interface DashboardData {
  summary: {
    vehicleCount: number;
    totalStockUnits: number;
    inventoryValue: string;
    lowStockCount: number;
    outOfStockCount: number;
    purchaseCount: number;
    unitsPurchased: number;
    purchaseRevenue: string;
  };
  vehiclesByCategory: {
    category: string;
    vehicleCount: number;
    stockUnits: number;
  }[];
  purchasesByDay: {
    date: string;
    purchaseCount: number;
    unitsPurchased: number;
    revenue: string;
  }[];
  topPurchasedVehicles: {
    vehicleMake: string;
    vehicleModel: string;
    unitsPurchased: number;
    revenue: string;
  }[];
  recentActivities: InventoryActivity[];
}
