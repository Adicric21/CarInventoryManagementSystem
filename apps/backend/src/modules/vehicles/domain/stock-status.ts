export const STOCK_STATUSES = ['OUT_OF_STOCK', 'LOW_STOCK', 'IN_STOCK'] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export interface StockState {
  stockStatus: StockStatus;
  isLowStock: boolean;
}

export function getStockStatus(quantity: number, lowStockThreshold: number): StockState {
  if (quantity === 0) {
    return { stockStatus: 'OUT_OF_STOCK', isLowStock: true };
  }

  if (quantity <= lowStockThreshold) {
    return { stockStatus: 'LOW_STOCK', isLowStock: true };
  }

  return { stockStatus: 'IN_STOCK', isLowStock: false };
}
