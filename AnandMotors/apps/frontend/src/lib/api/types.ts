export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
  stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VehiclePage {
  data: Vehicle[];
  meta: PaginationMeta;
}

export type VehicleSortField = 'make' | 'model' | 'category' | 'price' | 'quantity' | 'createdAt';

export interface VehicleSearchQuery {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  inStock?: boolean;
  page?: number;
  limit?: number;
  sortBy?: VehicleSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateVehicleInput {
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export interface LowStockVehicleQuery {
  page?: number;
  limit?: number;
  sortBy?: 'quantity' | 'make' | 'model' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export type InventoryActivityAction =
  | 'VEHICLE_CREATED'
  | 'VEHICLE_UPDATED'
  | 'VEHICLE_DELETED'
  | 'VEHICLE_PURCHASED'
  | 'VEHICLE_RESTOCKED';

export interface InventoryActivity {
  id: string;
  action: InventoryActivityAction;
  vehicleId: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleCategory: string;
  quantityBefore: number | null;
  quantityChange: number | null;
  quantityAfter: number | null;
  performedBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface InventoryActivityPage {
  data: InventoryActivity[];
  meta: PaginationMeta;
}

export interface InventoryActivityQuery {
  action?: InventoryActivityAction;
  vehicleId?: string;
  performedById?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface Purchase {
  id: string;
  vehicleId: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleCategory: string;
  unitPrice: string;
  quantity: number;
  totalAmount: string;
  purchasedAt: string;
  purchasedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PurchasePage {
  data: Purchase[];
  meta: PaginationMeta;
}

export interface PurchaseQuery {
  userId?: string;
  vehicleId?: string;
  make?: string;
  model?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

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
  vehiclesByCategory: { category: string; vehicleCount: number; stockUnits: number }[];
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

export interface VehicleCsvRow {
  row: number;
  make: string;
  model: string;
  category: string;
  price: string;
  quantity: number;
}

export interface VehicleCsvError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface VehicleCsvPreview {
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: VehicleCsvRow[];
  errors: VehicleCsvError[];
}
