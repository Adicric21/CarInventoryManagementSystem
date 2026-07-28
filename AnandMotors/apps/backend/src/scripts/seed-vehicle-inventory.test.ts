import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { parseVehicleCsv } from '../modules/vehicle-csv/application/vehicle-csv-parser.js';
import { selectMissingVehicles } from './seed-vehicle-inventory.js';

const inventoryCsvUrl = new URL('../../prisma/data/Indian_Car_Inventory_50.csv', import.meta.url);

describe('bundled vehicle inventory seed', () => {
  it('contains 50 unique valid cars', async () => {
    const preview = parseVehicleCsv(await readFile(inventoryCsvUrl));
    const identities = preview.rows.map(({ make, model, category }) =>
      JSON.stringify([make, model, category]),
    );

    expect(preview).toMatchObject({
      totalRows: 50,
      validRows: 50,
      invalidRows: 0,
      errors: [],
    });
    expect(new Set(identities)).toHaveLength(50);
  });

  it('does not reinsert an existing car or overwrite its current values', async () => {
    const preview = parseVehicleCsv(await readFile(inventoryCsvUrl));
    const seedVehicles = preview.rows.map(({ make, model, category, price, quantity }) => ({
      make,
      model,
      category,
      price,
      quantity,
    }));
    const [existingVehicle] = seedVehicles;

    expect(existingVehicle).toBeDefined();
    const missingVehicles = selectMissingVehicles(seedVehicles, [
      {
        make: existingVehicle?.make ?? '',
        model: existingVehicle?.model ?? '',
        category: existingVehicle?.category ?? '',
      },
    ]);

    expect(missingVehicles).toHaveLength(49);
    expect(missingVehicles).not.toContainEqual(existingVehicle);
  });
});
