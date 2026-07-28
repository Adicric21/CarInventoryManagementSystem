import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  createPersistedVehicleFixture,
  createVehicleFixture,
  VEHICLE_ID,
} from '../test-support/vehicle-fixtures.js';
import { createInventoryHttpSubject } from '../test-support/inventory-http-subject.js';

const ADMIN_AUTHORIZATION = 'Bearer admin-token';
const USER_AUTHORIZATION = 'Bearer user-token';
const PURCHASE_ROUTE = `/api/vehicles/${VEHICLE_ID}/purchase`;
const RESTOCK_ROUTE = `/api/vehicles/${VEHICLE_ID}/restock`;

const UNAUTHORIZED_RESPONSE = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication is required.',
    details: {},
  },
};

const FORBIDDEN_RESPONSE = {
  error: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    details: {},
  },
};

const VEHICLE_NOT_FOUND_RESPONSE = {
  error: {
    code: 'VEHICLE_NOT_FOUND',
    message: 'Vehicle not found.',
    details: {},
  },
};

const INSUFFICIENT_STOCK_RESPONSE = {
  error: {
    code: 'INSUFFICIENT_STOCK',
    message: 'Requested quantity exceeds available stock.',
    details: {},
  },
};

function inventoryResponse(quantity: number) {
  return { data: createVehicleFixture({ quantity }) };
}

function expectSharedValidationError(body: unknown): void {
  expect(body).toMatchObject({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'The request is invalid.',
    },
  });
  expect(body).toHaveProperty('error.details');
}

describe('POST /api/vehicles/:id/purchase', () => {
  it('allows an authenticated USER to purchase one unit', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(200);
  });

  it('allows an authenticated ADMIN to purchase', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 2 })
      .expect(200);
  });

  it('returns 401 when authentication is missing', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .send({ quantity: 1 })
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('returns 200 for a valid purchase', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(200);
  });

  it('decreases quantity by the requested amount', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 2 })
      .expect(200)
      .expect(inventoryResponse(3));
  });

  it('returns the updated vehicle', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(200)
      .expect(inventoryResponse(4));
  });

  it('allows purchase of the final available unit and returns quantity zero', async () => {
    const { app } = createInventoryHttpSubject({
      vehicle: createPersistedVehicleFixture({ quantity: 1 }),
    });

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(200)
      .expect(inventoryResponse(0));
  });

  it('returns 409 when the requested quantity exceeds available stock', async () => {
    const { app } = createInventoryHttpSubject({
      vehicle: createPersistedVehicleFixture({ quantity: 1 }),
    });

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 2 })
      .expect(409)
      .expect(INSUFFICIENT_STOCK_RESPONSE);
  });

  it('returns 409 when purchasing a vehicle with zero stock', async () => {
    const { app } = createInventoryHttpSubject({
      vehicle: createPersistedVehicleFixture({ quantity: 0 }),
    });

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(409)
      .expect(INSUFFICIENT_STOCK_RESPONSE);
  });

  it('returns 404 when the vehicle is missing', async () => {
    const { app } = createInventoryHttpSubject({ vehicle: null });

    await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(404)
      .expect(VEHICLE_NOT_FOUND_RESPONSE);
  });

  it('returns 400 when quantity is missing', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({})
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is zero', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 0 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is negative', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: -1 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is decimal', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1.5 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is non-numeric', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: '1' })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('handles an invalid vehicle id with the shared 400 response', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post('/api/vehicles/not-a-uuid/purchase')
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('rejects unknown request fields under the strict validation policy', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1, note: 'client supplied' })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('uses the shared error format for purchase failures', async () => {
    const { app } = createInventoryHttpSubject({
      vehicle: createPersistedVehicleFixture({ quantity: 0 }),
    });
    const response = await request(app)
      .post(PURCHASE_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 1 })
      .expect(409);

    expect(response.body).toEqual(INSUFFICIENT_STOCK_RESPONSE);
  });

  it('does not let a client-supplied role bypass authentication', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .send({ quantity: 1, role: 'ADMIN' })
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('does not let a client-supplied user id replace authenticated context', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(PURCHASE_ROUTE)
      .send({ quantity: 1, userId: '00000000-0000-4000-8000-000000000001' })
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });
});

describe('POST /api/vehicles/:id/restock', () => {
  it('allows an ADMIN to restock', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(200);
  });

  it('returns 403 when a USER attempts to restock', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
  });

  it('returns 401 when authentication is missing', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .send({ quantity: 5 })
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('returns 200 for a valid restock', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(200);
  });

  it('increases quantity by the requested amount', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 3 })
      .expect(200)
      .expect(inventoryResponse(8));
  });

  it('returns the updated vehicle', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(200)
      .expect(inventoryResponse(10));
  });

  it('returns 404 when the vehicle is missing', async () => {
    const { app } = createInventoryHttpSubject({ vehicle: null });

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(404)
      .expect(VEHICLE_NOT_FOUND_RESPONSE);
  });

  it('returns 400 when quantity is missing', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({})
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is zero', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 0 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is negative', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: -1 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is decimal', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 1.5 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('returns 400 when quantity is non-numeric', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: '5' })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('handles an invalid vehicle id with the shared 400 response', async () => {
    const { app } = createInventoryHttpSubject();
    const response = await request(app)
      .post('/api/vehicles/not-a-uuid/restock')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(400);

    expectSharedValidationError(response.body);
  });

  it('uses the shared error format for restock failures', async () => {
    const { app } = createInventoryHttpSubject({ vehicle: null });
    const response = await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(404);

    expect(response.body).toEqual(VEHICLE_NOT_FOUND_RESPONSE);
  });

  it('does not trust an ADMIN role supplied in the request body', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 5, role: 'ADMIN' })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
  });

  it('does not trust an ADMIN role supplied in the query string', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(`${RESTOCK_ROUTE}?role=ADMIN`)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 5 })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
  });

  it('does not trust an ADMIN role supplied in a custom header', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .post(RESTOCK_ROUTE)
      .set('Authorization', USER_AUTHORIZATION)
      .set('x-user-role', 'ADMIN')
      .send({ quantity: 5 })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
  });
});

describe('inventory route placement', () => {
  it('keeps /search resolving to vehicle search after inventory routes are added', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .get('/api/vehicles/search?make=toyota&sortBy=price&sortOrder=desc')
      .set('Authorization', USER_AUTHORIZATION)
      .expect(200)
      .expect({
        data: [createVehicleFixture()],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
  });
});

describe('GET /api/admin/vehicles/low-stock', () => {
  it('returns out-of-stock and threshold-matching vehicles to ADMIN', async () => {
    const { app } = createInventoryHttpSubject({
      vehicle: createPersistedVehicleFixture({ quantity: 0 }),
    });

    await request(app)
      .get('/api/admin/vehicles/low-stock')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(200)
      .expect({
        data: [createVehicleFixture({ quantity: 0 })],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
  });

  it('returns an empty page when every vehicle is above the configured threshold', async () => {
    const { app } = createInventoryHttpSubject({
      vehicle: createPersistedVehicleFixture({ quantity: 4 }),
    });

    await request(app)
      .get('/api/admin/vehicles/low-stock?page=1&limit=20')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(200)
      .expect({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
  });

  it('returns 403 to USER and 401 without authentication', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .get('/api/admin/vehicles/low-stock')
      .set('Authorization', USER_AUTHORIZATION)
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
    await request(app)
      .get('/api/admin/vehicles/low-stock')
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('rejects client thresholds and unsupported sort fields', async () => {
    const { app } = createInventoryHttpSubject();

    await request(app)
      .get('/api/admin/vehicles/low-stock?threshold=100')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(400);
    await request(app)
      .get('/api/admin/vehicles/low-stock?sortBy=price')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(400);
  });
});
