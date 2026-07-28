import type { BulkVehicleRepository } from '../domain/bulk-vehicle-repository.js';
import { VehicleCsvError } from '../domain/vehicle-csv-errors.js';
import { parseVehicleCsv } from './vehicle-csv-parser.js';

interface VehicleCsvDependencies {
  bulkVehicleRepository: BulkVehicleRepository;
}

function safeSpreadsheetText(value: string): string {
  return /^[=+\-@]/u.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = safeSpreadsheetText(value);
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export class VehicleCsvService {
  public constructor(private readonly dependencies: VehicleCsvDependencies) {}

  public preview(buffer: Buffer) {
    return { data: parseVehicleCsv(buffer) };
  }

  public async import(buffer: Buffer, performedById: string) {
    const preview = parseVehicleCsv(buffer);
    if (preview.invalidRows > 0) {
      throw new VehicleCsvError('CSV_INVALID_ROWS', 'CSV contains invalid rows.', {
        errors: preview.errors,
      });
    }
    const inputs = preview.rows.map(({ row: _row, ...input }) => input);
    const imported = await this.dependencies.bulkVehicleRepository.importWithActivities(
      inputs,
      performedById,
    );
    return { data: { imported } };
  }

  public async export(): Promise<string> {
    const vehicles = await this.dependencies.bulkVehicleRepository.findAllForExport();
    const lines = vehicles.map((vehicle) =>
      [
        csvCell(vehicle.make),
        csvCell(vehicle.model),
        csvCell(vehicle.category),
        vehicle.price,
        String(vehicle.quantity),
      ].join(','),
    );
    return `make,model,category,price,quantity\r\n${lines.map((line) => `${line}\r\n`).join('')}`;
  }
}
