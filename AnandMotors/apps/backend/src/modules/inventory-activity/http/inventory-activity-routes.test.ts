import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import { createInventoryActivityModule } from '../inventory-activity-module.js';
import type { InventoryActivityRepository } from '../domain/inventory-activity-repository.js';

const authApi: AuthApi = {
  request: () => Promise.resolve({ status: 404, body: undefined }),
};

const tokenProvider: TokenProvider = {
  generate: () => Promise.resolve('unused'),
  verify: (token) =>
    Promise.resolve({
      sub: token === 'admin-token' ? 'admin-id' : 'user-id',
      email: `${token}@example.com`,
      role: token === 'admin-token' ? 'ADMIN' : 'USER',
    }),
};

function createSubject(repository: InventoryActivityRepository) {
  const module = createInventoryActivityModule({
    inventoryActivityRepository: repository,
    tokenProvider,
  });
  return createApp(authApi, undefined, module.router);
}

function repositoryDouble() {
  return {
    findMany: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
  } satisfies InventoryActivityRepository;
}

describe('GET /api/admin/inventory/activities', () => {
  it('returns an empty PostgreSQL-paginated shape to ADMIN', async () => {
    const repository = repositoryDouble();

    await request(createSubject(repository))
      .get('/api/admin/inventory/activities?page=1&limit=20')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

    expect(repository.findMany).toHaveBeenCalledWith({
      filters: {},
      pagination: { skip: 0, take: 20 },
      sortOrder: 'desc',
    });
  });

  it('returns 403 to USER and 401 without authentication', async () => {
    const app = createSubject(repositoryDouble());

    await request(app)
      .get('/api/admin/inventory/activities')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
    await request(app).get('/api/admin/inventory/activities').expect(401);
  });

  it('returns 400 for unsupported actions and unknown filters', async () => {
    const app = createSubject(repositoryDouble());

    const invalidAction = await request(app)
      .get('/api/admin/inventory/activities?action=SECRET_EXPORTED')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);
    const unknownFilter = await request(app)
      .get('/api/admin/inventory/activities?token=secret')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);

    expect(invalidAction.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(unknownFilter.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
