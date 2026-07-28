import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import type { BulkVehicleRepository } from '../domain/bulk-vehicle-repository.js';
import { createVehicleCsvModule } from '../vehicle-csv-module.js';

const authApi: AuthApi = { request: () => Promise.resolve({ status: 404, body: undefined }) };
const tokenProvider: TokenProvider = {
  generate: () => Promise.resolve('unused'),
  verify: (token) =>
    Promise.resolve({
      sub: `${token}-id`,
      email: `${token}@example.com`,
      role: token === 'admin-token' ? 'ADMIN' : 'USER',
    }),
};

function createSubject() {
  const importWithActivities = vi.fn(() => Promise.resolve(1));
  const repository: BulkVehicleRepository = {
    importWithActivities,
    findAllForExport: vi.fn(() => Promise.resolve([])),
  };
  const module = createVehicleCsvModule({
    bulkVehicleRepository: repository,
    tokenProvider,
  });
  return {
    app: createApp(
      authApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      module.router,
    ),
    importWithActivities,
  };
}

const validCsv = Buffer.from('make,model,category,price,quantity\nToyota,Fortuner,SUV,3500000,5\n');

describe('administrator vehicle CSV routes', () => {
  it('previews multipart CSV without importing it', async () => {
    const { app, importWithActivities } = createSubject();
    const response = await request(app)
      .post('/api/admin/vehicles/import/preview')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', validCsv, 'vehicles.csv')
      .expect(200);
    expect(response.body).toMatchObject({
      data: { totalRows: 1, validRows: 1, invalidRows: 0 },
    });
    expect(importWithActivities).not.toHaveBeenCalled();
  });

  it('imports valid CSV and attributes every row to the administrator', async () => {
    const { app, importWithActivities } = createSubject();
    await request(app)
      .post('/api/admin/vehicles/import')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', validCsv, 'vehicles.csv')
      .expect(200)
      .expect({ data: { imported: 1 } });
    expect(importWithActivities).toHaveBeenCalledWith(
      [expect.objectContaining({ make: 'Toyota', price: '3500000' })],
      'admin-token-id',
    );
  });

  it('protects all CSV endpoints and requires a file', async () => {
    const { app } = createSubject();
    await request(app)
      .get('/api/admin/vehicles/export')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
    await request(app).post('/api/admin/vehicles/import/preview').expect(401);
    const missing = await request(app)
      .post('/api/admin/vehicles/import/preview')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);
    expect(missing.body).toMatchObject({ error: { code: 'CSV_FILE_REQUIRED' } });
  });

  it('exports a dated CSV attachment and rejects files larger than 2 MB', async () => {
    const { app } = createSubject();
    const exported = await request(app)
      .get('/api/admin/vehicles/export')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(exported.headers['content-type']).toMatch(/^text\/csv/u);
    expect(exported.headers['content-disposition']).toMatch(
      /^attachment; filename="vehicles-\d{4}-\d{2}-\d{2}\.csv"$/u,
    );
    expect(exported.text).toBe('make,model,category,price,quantity\r\n');

    const oversized = await request(app)
      .post('/api/admin/vehicles/import/preview')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1, 65), 'vehicles.csv')
      .expect(400);
    expect(oversized.body).toMatchObject({ error: { code: 'CSV_FILE_TOO_LARGE' } });
  });
});
