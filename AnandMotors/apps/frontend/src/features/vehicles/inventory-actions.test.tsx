import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../app-root.js';

const SESSION_KEY = 'car-dealership-session';
const VEHICLE_ID = '9f63e65c-f4c5-476a-aee0-743046032201';

type UserRole = 'USER' | 'ADMIN';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
  stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RecordedRequest {
  url: string;
  method: string;
  authorization: string | null;
  body: unknown;
}

const fetchMock = vi.fn<typeof fetch>();
const requests: RecordedRequest[] = [];

function createVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const quantity = overrides.quantity ?? 3;
  const stockState =
    quantity === 0
      ? { stockStatus: 'OUT_OF_STOCK' as const, isLowStock: true }
      : quantity <= 3
        ? { stockStatus: 'LOW_STOCK' as const, isLowStock: true }
        : { stockStatus: 'IN_STOCK' as const, isLowStock: false };

  return {
    id: VEHICLE_ID,
    make: 'Toyota',
    model: 'Fortuner',
    category: 'SUV',
    price: 4_250_000,
    quantity,
    ...stockState,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function vehiclePage(vehicle: Vehicle | undefined): unknown {
  return {
    data: vehicle === undefined ? [] : [vehicle],
    meta: {
      page: 1,
      limit: 10,
      total: vehicle === undefined ? 0 : 1,
      totalPages: vehicle === undefined ? 0 : 1,
    },
  };
}

function recordRequest(input: RequestInfo | URL, init?: RequestInit): RecordedRequest {
  const request = input instanceof Request ? input : undefined;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(request?.headers);

  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value);
  });

  const body: unknown =
    typeof init?.body === 'string' && init.body.length > 0 ? JSON.parse(init.body) : undefined;

  return {
    url,
    method: (init?.method ?? request?.method ?? 'GET').toUpperCase(),
    authorization: headers.get('Authorization'),
    body,
  };
}

function storeSession(role: UserRole): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: `${role.toLowerCase()}-access-token`,
      user: {
        id: `${role.toLowerCase()}-0001`,
        name: role === 'ADMIN' ? 'Admin User' : 'Regular User',
        email: `${role.toLowerCase()}@example.com`,
        role,
      },
    }),
  );
}

function installVehicleApi(
  vehicle: Vehicle,
  mutate?: (request: RecordedRequest) => Promise<Response>,
): void {
  let currentVehicle = vehicle;

  fetchMock.mockImplementation((input, init) => {
    const request = recordRequest(input, init);
    requests.push(request);

    if (request.method === 'GET' && request.url.includes('/vehicles')) {
      const onlyInStock = new URL(request.url, 'http://localhost').searchParams.get('inStock');
      return Promise.resolve(
        jsonResponse(
          vehiclePage(
            onlyInStock === 'true' && currentVehicle.quantity === 0 ? undefined : currentVehicle,
          ),
        ),
      );
    }

    if (mutate !== undefined) {
      return mutate(request).then(async (response) => {
        if (response.ok && request.url.endsWith(`/${VEHICLE_ID}/purchase`)) {
          const body: unknown = await response.clone().json();
          if (
            typeof body === 'object' &&
            body !== null &&
            'data' in body &&
            typeof body.data === 'object' &&
            body.data !== null
          ) {
            currentVehicle = body.data as Vehicle;
          }
        }

        return response;
      });
    }

    return Promise.resolve(
      jsonResponse({ error: { code: 'UNEXPECTED_REQUEST', message: 'Unexpected request.' } }, 500),
    );
  });
}

async function renderCatalogue(role: UserRole, vehicle: Vehicle): Promise<void> {
  storeSession(role);
  window.history.replaceState({}, '', '/vehicles');
  render(<App />);

  await screen.findByRole('heading', { name: `${vehicle.make} ${vehicle.model}` });
}

function purchaseRequests(): RecordedRequest[] {
  return requests.filter(
    ({ method, url }) => method === 'POST' && url.endsWith(`/vehicles/${VEHICLE_ID}/purchase`),
  );
}

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolver: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>((resolve) => {
    resolver = resolve;
  });

  return {
    promise,
    resolve(response) {
      if (resolver === undefined) {
        throw new Error('Deferred response was not initialized.');
      }

      resolver(response);
    },
  };
}

beforeEach(() => {
  requests.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('vehicle purchasing', () => {
  it.each<UserRole>(['USER', 'ADMIN'])('%s can purchase an available vehicle', async (role) => {
    const vehicle = createVehicle();
    installVehicleApi(vehicle);

    await renderCatalogue(role, vehicle);

    expect(screen.getByRole('button', { name: /purchase/i })).toBeEnabled();
  });

  it('disables purchase and identifies a vehicle when stock is unavailable', async () => {
    const vehicle = createVehicle({ quantity: 0 });
    installVehicleApi(vehicle);

    await renderCatalogue('USER', vehicle);

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /purchase/i })).toBeDisabled();
  });

  it('sends one positive integer unit with authentication and prevents duplicate pending requests', async () => {
    const vehicle = createVehicle();
    const pendingPurchase = deferredResponse();
    installVehicleApi(vehicle, (request) => {
      if (request.url.endsWith(`/${VEHICLE_ID}/purchase`)) {
        return pendingPurchase.promise;
      }

      return Promise.resolve(jsonResponse({}, 500));
    });
    await renderCatalogue('USER', vehicle);
    const user = userEvent.setup();
    const purchaseButton = screen.getByRole('button', { name: /purchase/i });

    await user.click(purchaseButton);

    await waitFor(() => {
      expect(purchaseRequests()).toHaveLength(1);
    });
    expect(purchaseButton).toBeDisabled();
    expect(screen.getByText(/quantity:\s*3/i)).toBeInTheDocument();
    await user.click(purchaseButton);
    expect(purchaseRequests()).toHaveLength(1);
    expect(purchaseRequests()[0]).toMatchObject({
      method: 'POST',
      authorization: 'Bearer user-access-token',
      body: { quantity: 1 },
    });

    pendingPurchase.resolve(jsonResponse({ data: createVehicle({ quantity: 2 }) }));
    await screen.findByText(/quantity:\s*2/i);
  });

  it('updates the quantity, out-of-stock status and feedback after purchasing the final unit', async () => {
    const vehicle = createVehicle({ quantity: 1 });
    installVehicleApi(vehicle, (request) =>
      Promise.resolve(
        request.url.endsWith(`/${VEHICLE_ID}/purchase`)
          ? jsonResponse({ data: createVehicle({ quantity: 0 }) })
          : jsonResponse({}, 500),
      ),
    );
    await renderCatalogue('USER', vehicle);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /purchase/i }));

    expect(await screen.findByText(/quantity:\s*0/i)).toBeInTheDocument();
    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
    expect(screen.getByText(/vehicle purchased successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /purchase/i })).toBeDisabled();
  });

  it('refetches an in-stock filter after purchasing its final visible unit', async () => {
    const vehicle = createVehicle({ quantity: 1 });
    installVehicleApi(vehicle, (request) =>
      Promise.resolve(
        request.url.endsWith(`/${VEHICLE_ID}/purchase`)
          ? jsonResponse({ data: createVehicle({ quantity: 0 }) })
          : jsonResponse({}, 500),
      ),
    );
    await renderCatalogue('USER', vehicle);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: /in stock only/i }));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));
    await waitFor(() => {
      expect(requests.some(({ url }) => url.includes('inStock=true'))).toBe(true);
    });
    await user.click(screen.getByRole('button', { name: /purchase/i }));

    expect(
      await screen.findByRole('heading', { name: /no vehicles match your filters/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: `${vehicle.make} ${vehicle.model}` }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      code: 'INSUFFICIENT_STOCK',
      apiMessage: 'Requested quantity exceeds available stock.',
      expectedMessage: /not enough stock|insufficient stock|exceeds available stock/i,
      status: 409,
    },
    {
      code: 'VEHICLE_NOT_FOUND',
      apiMessage: 'Vehicle not found.',
      expectedMessage: /vehicle (?:was )?not found|no longer available/i,
      status: 404,
    },
  ])(
    'handles $code purchase errors safely',
    async ({ apiMessage, code, expectedMessage, status }) => {
      const internalDetail = 'database host and stack trace must stay private';
      const vehicle = createVehicle();
      installVehicleApi(vehicle, (request) =>
        Promise.resolve(
          request.url.endsWith(`/${VEHICLE_ID}/purchase`)
            ? jsonResponse(
                { error: { code, message: apiMessage, details: { internalDetail } } },
                status,
              )
            : jsonResponse({}, 500),
        ),
      );
      await renderCatalogue('USER', vehicle);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /purchase/i }));

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(screen.queryByText(internalDetail)).not.toBeInTheDocument();
      expect(screen.getByText(/quantity:\s*3/i)).toBeInTheDocument();
    },
  );

  it('does not optimistically decrease stock when a purchase fails', async () => {
    const vehicle = createVehicle({ quantity: 5 });
    const pendingPurchase = deferredResponse();
    installVehicleApi(vehicle, (request) =>
      request.url.endsWith(`/${VEHICLE_ID}/purchase`)
        ? pendingPurchase.promise
        : Promise.resolve(jsonResponse({}, 500)),
    );
    await renderCatalogue('USER', vehicle);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /purchase/i }));
    expect(screen.getByText(/quantity:\s*5/i)).toBeInTheDocument();

    pendingPurchase.resolve(
      jsonResponse(
        {
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Requested quantity exceeds available stock.',
          },
        },
        409,
      ),
    );

    await screen.findByText(/not enough stock|insufficient stock|exceeds available stock/i);
    expect(screen.getByText(/quantity:\s*5/i)).toBeInTheDocument();
  });
});
