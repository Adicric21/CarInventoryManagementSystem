import type { Express } from 'express';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import type { VehicleDependencies } from '../domain/vehicle-repository.js';
import { createVehicleModule } from '../vehicle-module.js';

const unusedAuthApi: AuthApi = {
  request: (_request) =>
    Promise.resolve({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Route not found.', details: {} } },
    }),
};

function createPurchaseTestTokenProvider(userId: string): TokenProvider {
  return {
    generate: (_payload) => Promise.resolve('unused-purchase-test-token'),
    verify: (token) => {
      if (token !== 'purchase-user-token') {
        return Promise.reject(new Error('Invalid purchase test token'));
      }

      return Promise.resolve({
        sub: userId,
        email: 'purchase-user@example.com',
        role: 'USER',
      });
    },
  };
}

export function createConcurrentPurchaseHttpSubject(
  dependencies: VehicleDependencies,
  userId: string,
): Express {
  const vehicles = createVehicleModule({
    ...dependencies,
    tokenProvider: createPurchaseTestTokenProvider(userId),
  });

  return createApp(unusedAuthApi, vehicles.router);
}
