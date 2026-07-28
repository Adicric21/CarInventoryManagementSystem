import { describe, expect, it, vi } from 'vitest';

import type { BulkVehicleRepository } from '../domain/bulk-vehicle-repository.js';
import { VehicleCsvService } from './vehicle-csv.js';

function subject() {
  const importWithActivities = vi.fn(() => Promise.resolve(2));
  const repository: BulkVehicleRepository = {
    importWithActivities,
    findAllForExport: vi.fn(() =>
      Promise.resolve([
        {
          make: '=Formula',
          model: 'Model, "Quoted"',
          category: 'SUV',
          price: '3500000.00',
          quantity: 5,
        },
      ]),
    ),
  };
  return {
    service: new VehicleCsvService({ bulkVehicleRepository: repository }),
    importWithActivities,
  };
}

describe('vehicle CSV', () => {
  it('previews valid quoted rows without writing to persistence', () => {
    const { service, importWithActivities } = subject();
    const preview = service.preview(
      Buffer.from(
        'make,model,category,price,quantity\r\nToyota,"Fortuner, Legender",SUV,3500000.25,5\r\n',
      ),
    );

    expect(preview.data).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [
        {
          row: 2,
          make: 'Toyota',
          model: 'Fortuner, Legender',
          price: '3500000.25',
          quantity: 5,
        },
      ],
    });
    expect(importWithActivities).not.toHaveBeenCalled();
  });

  it('reports row-specific validation errors and rejects an invalid import', async () => {
    const { service, importWithActivities } = subject();
    const csv = Buffer.from(
      'make,model,category,price,quantity\nToyota,,SUV,-1,1.5\nHonda,City,Sedan,1500000,2\n',
    );

    const result = service.preview(csv).data;
    expect(result).toMatchObject({
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
    });
    expect(result.errors.map(({ field }) => field)).toEqual(['model', 'price', 'quantity']);
    await expect(service.import(csv, 'admin-id')).rejects.toMatchObject({
      status: 400,
      code: 'CSV_INVALID_ROWS',
    });
    expect(importWithActivities).not.toHaveBeenCalled();
  });

  it('exports deterministic fields with quoting and spreadsheet formulas neutralized', async () => {
    const { service } = subject();

    const csv = await service.export();

    expect(csv).toBe(
      'make,model,category,price,quantity\r\n' +
        `'=Formula,"Model, ""Quoted""",SUV,3500000.00,5\r\n`,
    );
  });

  it('rejects invalid headers and files above the row limit', () => {
    const { service } = subject();
    expect(() => service.preview(Buffer.from('make,model,price\nToyota,City,100\n'))).toThrowError(
      expect.objectContaining({ code: 'CSV_INVALID_HEADERS' }),
    );
    const rows = Array.from({ length: 1_001 }, () => 'Toyota,City,Sedan,100,1').join('\n');
    expect(() =>
      service.preview(Buffer.from(`make,model,category,price,quantity\n${rows}`)),
    ).toThrowError(expect.objectContaining({ code: 'CSV_ROW_LIMIT_EXCEEDED' }));
  });
});
