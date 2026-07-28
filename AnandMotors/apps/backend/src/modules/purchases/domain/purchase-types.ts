export interface PersistedPurchase {
  id: string;
  vehicleId: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleCategory: string;
  unitPrice: string;
  quantity: number;
  totalAmount: string;
  purchasedAt: Date;
  purchasedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Purchase extends Omit<PersistedPurchase, 'purchasedAt'> {
  purchasedAt: string;
}

export interface PurchasePage {
  data: Purchase[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function toPurchase(purchase: PersistedPurchase): Purchase {
  return { ...purchase, purchasedAt: purchase.purchasedAt.toISOString() };
}
