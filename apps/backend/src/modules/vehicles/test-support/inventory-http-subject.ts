import type { Express } from 'express';

import { createApp } from '../../../app.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import type { AuthApi } from '../../auth/http/http-contracts.js';
import type {
  AtomicPurchaseResult,
  CreateVehicleData,
  FindVehiclesQuery,
  UpdateVehicleData,
  VehicleFilters,
  VehicleRepository,
} from '../domain/vehicle-repository.js';
import type { PersistedVehicle } from '../domain/vehicle-types.js';
import { createVehicleModule } from '../vehicle-module.js';
import { createPersistedVehicleFixture, SECOND_VEHICLE_ID } from './vehicle-fixtures.js';

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

class InMemoryInventoryHttpRepository implements VehicleRepository {
  private readonly vehicles = new Map<string, PersistedVehicle>();

  constructor(vehicle: PersistedVehicle | null) {
    if (vehicle !== null) {
      this.vehicles.set(vehicle.id, vehicle);
    }
  }

  create(input: CreateVehicleData): Promise<PersistedVehicle> {
    const vehicle = createPersistedVehicleFixture({ id: SECOND_VEHICLE_ID, ...input });
    this.vehicles.set(vehicle.id, vehicle);
    return Promise.resolve(vehicle);
  }

  createWithActivity(input: CreateVehicleData, _performedById: string): Promise<PersistedVehicle> {
    return this.create(input);
  }

  findMany(query: FindVehiclesQuery): Promise<PersistedVehicle[]> {
    const vehicles = [...this.vehicles.values()].filter(
      ({ quantity }) =>
        query.filters.maxQuantity === undefined || quantity <= query.filters.maxQuantity,
    );
    return Promise.resolve(
      vehicles.slice(query.pagination.skip, query.pagination.skip + query.pagination.take),
    );
  }

  count(filters: VehicleFilters): Promise<number> {
    return Promise.resolve(
      [...this.vehicles.values()].filter(
        ({ quantity }) => filters.maxQuantity === undefined || quantity <= filters.maxQuantity,
      ).length,
    );
  }

  findById(id: string): Promise<PersistedVehicle | null> {
    return Promise.resolve(this.vehicles.get(id) ?? null);
  }

  update(id: string, input: UpdateVehicleData): Promise<PersistedVehicle | null> {
    const vehicle = this.vehicles.get(id);

    if (vehicle === undefined) {
      return Promise.resolve(null);
    }

    const updatedVehicle = { ...vehicle, ...input };
    this.vehicles.set(id, updatedVehicle);
    return Promise.resolve(updatedVehicle);
  }

  updateWithActivity(
    id: string,
    input: UpdateVehicleData,
    _performedById: string,
  ): Promise<PersistedVehicle | null> {
    return this.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.vehicles.delete(id));
  }

  deleteWithActivity(id: string, _performedById: string): Promise<boolean> {
    return this.delete(id);
  }

  purchaseAtomic(id: string, quantity: number): Promise<AtomicPurchaseResult> {
    const vehicle = this.vehicles.get(id);

    if (vehicle === undefined) {
      return Promise.resolve({ outcome: 'notFound' });
    }

    if (vehicle.quantity < quantity) {
      return Promise.resolve({ outcome: 'insufficientStock' });
    }

    const updatedVehicle = { ...vehicle, quantity: vehicle.quantity - quantity };
    this.vehicles.set(id, updatedVehicle);
    return Promise.resolve({ outcome: 'updated', vehicle: updatedVehicle });
  }

  purchaseWithActivity(
    id: string,
    quantity: number,
    _performedById: string,
  ): Promise<AtomicPurchaseResult> {
    return this.purchaseAtomic(id, quantity);
  }

  restockAtomic(id: string, quantity: number): Promise<PersistedVehicle | null> {
    const vehicle = this.vehicles.get(id);

    if (vehicle === undefined) {
      return Promise.resolve(null);
    }

    const updatedVehicle = { ...vehicle, quantity: vehicle.quantity + quantity };
    this.vehicles.set(id, updatedVehicle);
    return Promise.resolve(updatedVehicle);
  }

  restockWithActivity(
    id: string,
    quantity: number,
    _performedById: string,
  ): Promise<PersistedVehicle | null> {
    return this.restockAtomic(id, quantity);
  }
}

interface InventoryHttpSubjectOptions {
  vehicle?: PersistedVehicle | null;
}

export interface InventoryHttpSubject {
  app: Express;
  repository: VehicleRepository;
}

export function createInventoryHttpSubject(
  options: InventoryHttpSubjectOptions = {},
): InventoryHttpSubject {
  const repository = new InMemoryInventoryHttpRepository(
    options.vehicle === undefined ? createPersistedVehicleFixture() : options.vehicle,
  );
  const vehicles = createVehicleModule({
    vehicleRepository: repository,
    lowStockThreshold: 3,
    tokenProvider: createTokenProvider(),
  });

  return {
    app: createApp(unusedAuthApi, vehicles.router, undefined, vehicles.adminRouter),
    repository,
  };
}
