import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import type { DashboardRepository } from '../domain/dashboard-repository.js';
import { createDashboardModule } from '../dashboard-module.js';

const authApi: AuthApi = {
  request: () => Promise.resolve({ status: 404, body: undefined }),
};
const tokenProvider: TokenProvider = {
  generate: () => Promise.resolve('unused'),
  verify: (token) =>
    Promise.resolve({
      sub: `${token}-id`,
      email: `${token}@example.com`,
      role: token === 'admin-token' ? 'ADMIN' : 'USER',
    }),
};
const emptyDashboard = {
  summary: {
    vehicleCount: 0,
    totalStockUnits: 0,
    inventoryValue: '0.00',
    lowStockCount: 0,
    outOfStockCount: 0,
    purchaseCount: 0,
    unitsPurchased: 0,
    purchaseRevenue: '0.00',
  },
  vehiclesByCategory: [],
  purchasesByDay: [],
  topPurchasedVehicles: [],
  recentActivities: [],
};

function createSubject() {
  const getDashboard = vi.fn(() => Promise.resolve(emptyDashboard));
  const repository: DashboardRepository = {
    getDashboard,
  };
  const dashboard = createDashboardModule({
    dashboardRepository: repository,
    lowStockThreshold: 3,
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
      dashboard.router,
    ),
    getDashboard,
  };
}

describe('GET /api/admin/dashboard', () => {
  it('returns zero-safe analytics to an administrator', async () => {
    await request(createSubject().app)
      .get('/api/admin/dashboard?period=7d')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect({ data: emptyDashboard });
  });

  it('rejects users, missing authentication, and invalid periods', async () => {
    const { app, getDashboard } = createSubject();
    await request(app).get('/api/admin/dashboard').expect(401);
    await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
    await request(app)
      .get('/api/admin/dashboard?period=365d')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);
    expect(getDashboard).not.toHaveBeenCalled();
  });
});
