import { readFile } from 'node:fs/promises';

import type { PrismaClient } from '../generated/prisma/client.js';
import { parseVehicleCsv } from '../modules/vehicle-csv/application/vehicle-csv-parser.js';
import { PrismaBulkVehicleRepository } from '../modules/vehicle-csv/infrastructure/prisma-bulk-vehicle-repository.js';
import type { CreateVehicleData } from '../modules/vehicles/domain/vehicle-repository.js';

const inventoryCsvUrl = new URL('../../prisma/data/Indian_Car_Inventory_50.csv', import.meta.url);

type VehicleIdentity = Pick<CreateVehicleData, 'make' | 'model' | 'category'>;

const identityKey = ({ make, model, category }: VehicleIdentity): string =>
  JSON.stringify([make, model, category]);

export function selectMissingVehicles(
  seedVehicles: readonly CreateVehicleData[],
  existingVehicles: readonly VehicleIdentity[],
): CreateVehicleData[] {
  const existingIdentities = new Set(existingVehicles.map(identityKey));

  return seedVehicles.filter((vehicle) => !existingIdentities.has(identityKey(vehicle)));
}

export interface InventorySeedResult {
  total: number;
  inserted: number;
  skipped: number;
}

export async function seedVehicleInventory(
  prisma: PrismaClient,
  performedById: string,
): Promise<InventorySeedResult> {
  const preview = parseVehicleCsv(await readFile(inventoryCsvUrl));

  if (preview.invalidRows > 0) {
    throw new Error(`Bundled inventory CSV contains ${preview.invalidRows} invalid rows.`);
  }

  const seedVehicles = preview.rows.map(({ make, model, category, price, quantity }) => ({
    make,
    model,
    category,
    price,
    quantity,
  }));
  const existingVehicles = await prisma.vehicle.findMany({
    where: {
      OR: seedVehicles.map(({ make, model, category }) => ({ make, model, category })),
    },
    select: { make: true, model: true, category: true },
  });
  const missingVehicles = selectMissingVehicles(seedVehicles, existingVehicles);

  if (missingVehicles.length > 0) {
    const repository = new PrismaBulkVehicleRepository(prisma);
    await repository.importWithActivities(missingVehicles, performedById);
  }

  return {
    total: seedVehicles.length,
    inserted: missingVehicles.length,
    skipped: seedVehicles.length - missingVehicles.length,
  };
}
