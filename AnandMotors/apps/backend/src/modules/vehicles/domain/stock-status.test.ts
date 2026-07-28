import { describe, expect, it } from 'vitest';

import { getStockStatus } from './stock-status.js';

describe('stock status', () => {
  it.each([
    [0, 'OUT_OF_STOCK', true],
    [1, 'LOW_STOCK', true],
    [3, 'LOW_STOCK', true],
    [4, 'IN_STOCK', false],
  ] as const)(
    'maps quantity %s using the configured threshold',
    (quantity, stockStatus, isLowStock) => {
      expect(getStockStatus(quantity, 3)).toEqual({ stockStatus, isLowStock });
    },
  );
});
