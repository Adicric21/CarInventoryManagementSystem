import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createVehicleDependencies } from '../test-support/vehicle-doubles.js';
import {
  createCreateVehicleInput,
  createPersistedVehicleFixture,
  createVehicleFixture,
  VEHICLE_ID,
} from '../test-support/vehicle-fixtures.js';
import { createVehicleHttpSubject } from '../test-support/vehicle-http-subject.js';

const ADMIN_AUTHORIZATION = 'Bearer admin-token';
const USER_AUTHORIZATION = 'Bearer user-token';

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

describe('vehicle management routes', () => {
  it('allows an ADMIN to create a vehicle and returns 201 with generated fields', async () => {
    const dependencies = createVehicleDependencies();
    const app = createVehicleHttpSubject(dependencies);

    await request(app)
      .post('/api/vehicles')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send(createCreateVehicleInput())
      .expect(201)
      .expect({ data: { vehicle: createVehicleFixture() } });

    expect(dependencies.vehicleRepository.createWithActivity).toHaveBeenCalledWith(
      expect.objectContaining({ make: 'Toyota' }),
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('rejects USER and unauthenticated vehicle creation', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .post('/api/vehicles')
      .set('Authorization', USER_AUTHORIZATION)
      .send(createCreateVehicleInput())
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
    await request(app)
      .post('/api/vehicles')
      .send(createCreateVehicleInput())
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('does not trust an ADMIN role supplied by a USER in the request body', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .post('/api/vehicles')
      .set('Authorization', USER_AUTHORIZATION)
      .send({ ...createCreateVehicleInput(), role: 'ADMIN' })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
  });

  it.each([
    ['blank make', { ...createCreateVehicleInput(), make: '   ' }],
    ['zero price', { ...createCreateVehicleInput(), price: 0 }],
    ['decimal quantity', { ...createCreateVehicleInput(), quantity: 1.5 }],
    ['unknown fields', { ...createCreateVehicleInput(), colour: 'black' }],
  ])('returns the shared 400 response for %s', async (_case, body) => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
    });
    expect(response.body).toHaveProperty('error.details');
  });

  it.each([ADMIN_AUTHORIZATION, USER_AUTHORIZATION])(
    'allows an authenticated role to list vehicles',
    async (authorization) => {
      const dependencies = createVehicleDependencies();
      dependencies.vehicleRepository.findMany.mockResolvedValue([createPersistedVehicleFixture()]);
      dependencies.vehicleRepository.count.mockResolvedValue(1);
      const app = createVehicleHttpSubject(dependencies);

      await request(app)
        .get('/api/vehicles?page=1&limit=10')
        .set('Authorization', authorization)
        .expect(200)
        .expect({
          data: [createVehicleFixture()],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
    },
  );

  it('requires authentication to list vehicles', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app).get('/api/vehicles').expect(401).expect(UNAUTHORIZED_RESPONSE);
  });

  it.each([USER_AUTHORIZATION, ADMIN_AUTHORIZATION])(
    'resolves /search before parameterized routes for an authenticated role',
    async (authorization) => {
      const dependencies = createVehicleDependencies();
      dependencies.vehicleRepository.findMany.mockResolvedValue([createPersistedVehicleFixture()]);
      dependencies.vehicleRepository.count.mockResolvedValue(1);
      const app = createVehicleHttpSubject(dependencies);

      await request(app)
        .get('/api/vehicles/search?make=toyota&sortBy=price&sortOrder=desc')
        .set('Authorization', authorization)
        .expect(200)
        .expect({
          data: [createVehicleFixture()],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
    },
  );

  it('requires authentication to search vehicles', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .get('/api/vehicles/search?category=SUV')
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('allows an ADMIN to partially update an existing vehicle', async () => {
    const dependencies = createVehicleDependencies();
    dependencies.vehicleRepository.update.mockResolvedValue(
      createPersistedVehicleFixture({ model: 'Fortuner Legender' }),
    );
    const app = createVehicleHttpSubject(dependencies);

    await request(app)
      .put(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ model: 'Fortuner Legender' })
      .expect(200)
      .expect({
        data: {
          vehicle: createVehicleFixture({ model: 'Fortuner Legender' }),
        },
      });
  });

  it('rejects a USER attempting to update a vehicle', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .put(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', USER_AUTHORIZATION)
      .send({ quantity: 2 })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
  });

  it('rejects an unauthenticated user attempting to update a vehicle', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .put(`/api/vehicles/${VEHICLE_ID}`)
      .send({ quantity: 2 })
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });

  it('returns 404 for a missing vehicle', async () => {
    const dependencies = createVehicleDependencies();
    dependencies.vehicleRepository.findById.mockResolvedValue(null);
    const app = createVehicleHttpSubject(dependencies);

    await request(app)
      .put(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 2 })
      .expect(404)
      .expect({
        error: { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found.', details: {} },
      });
  });

  it('returns 400 for an invalid vehicle id', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .put('/api/vehicles/not-a-uuid')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ quantity: 2 })
      .expect(400);
  });

  it('returns 400 for an empty vehicle update body', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .put(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({})
      .expect(400);
  });

  it('allows an ADMIN to delete a vehicle with 204 and returns 404 when repeated', async () => {
    const dependencies = createVehicleDependencies();
    dependencies.vehicleRepository.delete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const app = createVehicleHttpSubject(dependencies);

    await request(app)
      .delete(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(204);
    await request(app)
      .delete(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(404)
      .expect({
        error: { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found.', details: {} },
      });
  });

  it('rejects USER, unauthenticated and client-role delete attempts', async () => {
    const app = createVehicleHttpSubject(createVehicleDependencies());

    await request(app)
      .delete(`/api/vehicles/${VEHICLE_ID}`)
      .set('Authorization', USER_AUTHORIZATION)
      .set('x-user-role', 'ADMIN')
      .send({ role: 'ADMIN' })
      .expect(403)
      .expect(FORBIDDEN_RESPONSE);
    await request(app)
      .delete(`/api/vehicles/${VEHICLE_ID}`)
      .expect(401)
      .expect(UNAUTHORIZED_RESPONSE);
  });
});
