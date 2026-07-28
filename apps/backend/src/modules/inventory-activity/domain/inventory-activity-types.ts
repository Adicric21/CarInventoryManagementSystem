export const INVENTORY_ACTIVITY_ACTIONS = [
  'VEHICLE_CREATED',
  'VEHICLE_UPDATED',
  'VEHICLE_DELETED',
  'VEHICLE_PURCHASED',
  'VEHICLE_RESTOCKED',
] as const;

export type InventoryActivityAction = (typeof INVENTORY_ACTIVITY_ACTIONS)[number];

export interface InventoryActivityActor {
  id: string;
  name: string;
  email: string;
}

export interface PersistedInventoryActivity {
  id: string;
  action: InventoryActivityAction;
  vehicleId: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleCategory: string;
  quantityBefore: number | null;
  quantityChange: number | null;
  quantityAfter: number | null;
  performedBy: InventoryActivityActor;
  metadata: unknown;
  createdAt: Date;
}

export interface InventoryActivity extends Omit<
  PersistedInventoryActivity,
  'createdAt' | 'metadata'
> {
  createdAt: string;
}

export interface InventoryActivityPage {
  data: InventoryActivity[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function toInventoryActivity(activity: PersistedInventoryActivity): InventoryActivity {
  return {
    id: activity.id,
    action: activity.action,
    vehicleId: activity.vehicleId,
    vehicleMake: activity.vehicleMake,
    vehicleModel: activity.vehicleModel,
    vehicleCategory: activity.vehicleCategory,
    quantityBefore: activity.quantityBefore,
    quantityChange: activity.quantityChange,
    quantityAfter: activity.quantityAfter,
    performedBy: activity.performedBy,
    createdAt: activity.createdAt.toISOString(),
  };
}
