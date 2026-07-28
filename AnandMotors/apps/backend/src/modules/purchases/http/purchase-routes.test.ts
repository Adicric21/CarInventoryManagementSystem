import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import type { PurchaseRepository } from '../domain/purchase-repository.js';
import { createPurchaseModule } from '../purchase-module.js';

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

function repositoryDouble() {
  return {
    findMany: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
  } satisfies PurchaseRepository;
}

function createSubject(repository: PurchaseRepository) {
  const purchases = createPurchaseModule({ purchaseRepository: repository, tokenProvider });
  return createApp(
    authApi,
    undefined,
    undefined,
    undefined,
    purchases.router,
    purchases.adminRouter,
  );
}

describe('purchase history routes', () => {
  it('scopes personal history to the authenticated user', async () => {
    const repository = repositoryDouble();

    await request(createSubject(repository))
      .get('/api/purchases/me?page=1&limit=20')
      .set('Authorization', 'Bearer user-token')
      .expect(200)
      .expect({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

    expect(repository.findMany).toHaveBeenCalledWith({
      filters: { userId: 'user-id' },
      pagination: { skip: 0, take: 20 },
      sortOrder: 'desc',
    });
  });

  it('rejects attempts to override personal user scope', async () => {
    const repository = repositoryDouble();

    await request(createSubject(repository))
      .get('/api/purchases/me?userId=admin-id')
      .set('Authorization', 'Bearer user-token')
      .expect(400);

    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it('allows only administrators to list all purchases', async () => {
    const app = createSubject(repositoryDouble());

    await request(app).get('/api/admin/purchases').expect(401);
    await request(app)
      .get('/api/admin/purchases')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
    await request(app)
      .get('/api/admin/purchases?userId=00000000-0000-4000-8000-000000000001')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });
});
