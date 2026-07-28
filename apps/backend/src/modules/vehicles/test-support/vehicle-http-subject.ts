import type { Express } from 'express';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import { createVehicleModule } from '../vehicle-module.js';
import type { VehicleDependencies } from './vehicle-contracts.js';

const unusedAuthApi: AuthApi = {
  request: (_request) =>
    Promise.resolve({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Route not found.', details: {} } },
    }),
};

function createTokenProvider(): TokenProvider {
  return {
    generate: (_payload) => Promise.resolve('unused-test-token'),
    verify: (token) => {
      if (token === 'admin-token') {
        return Promise.resolve({
          sub: '00000000-0000-4000-8000-000000000001',
          email: 'admin@example.com',
          role: 'ADMIN',
        });
      }

      if (token === 'user-token') {
        return Promise.resolve({
          sub: '00000000-0000-4000-8000-000000000002',
          email: 'user@example.com',
          role: 'USER',
        });
      }

      return Promise.reject(new Error('Invalid test token'));
    },
  };
}

export function createVehicleHttpSubject(dependencies: VehicleDependencies): Express {
  const vehicles = createVehicleModule({
    ...dependencies,
    tokenProvider: createTokenProvider(),
  });

  return createApp(unusedAuthApi, vehicles.router);
}
