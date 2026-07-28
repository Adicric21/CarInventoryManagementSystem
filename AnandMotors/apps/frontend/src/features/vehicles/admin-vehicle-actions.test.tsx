import { render, screen, waitFor, within } from '@testing-library/react';
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

interface VehicleApi {
  setVehicles: (vehicles: Vehicle[]) => void;
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

function vehiclePage(vehicles: Vehicle[]): unknown {
  return {
    data: vehicles,
    meta: { page: 1, limit: 10, total: vehicles.length, totalPages: vehicles.length === 0 ? 0 : 1 },
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
  initialVehicles: Vehicle[],
  mutate?: (request: RecordedRequest) => Promise<Response>,
): VehicleApi {
  let vehicles = [...initialVehicles];

  fetchMock.mockImplementation((input, init) => {
    const request = recordRequest(input, init);
    requests.push(request);

    if (request.method === 'GET' && request.url.includes('/vehicles')) {
      return Promise.resolve(jsonResponse(vehiclePage(vehicles)));
    }

    if (mutate !== undefined) {
      return mutate(request);
    }

    return Promise.resolve(
      jsonResponse({ error: { code: 'UNEXPECTED_REQUEST', message: 'Unexpected request.' } }, 500),
    );
  });

  return {
    setVehicles(nextVehicles) {
      vehicles = [...nextVehicles];
    },
  };
}

async function renderCatalogue(role: UserRole, vehicle: Vehicle): Promise<void> {
  storeSession(role);
  window.history.replaceState({}, '', '/vehicles');
  render(<App />);

  await screen.findByRole('heading', { name: `${vehicle.make} ${vehicle.model}` });
}

function mutationRequests(method: string, suffix: string): RecordedRequest[] {
  return requests.filter((request) => request.method === method && request.url.endsWith(suffix));
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

async function openAddVehicleForm(): Promise<HTMLElement> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /add vehicle/i }));
  return screen.getByRole('dialog', { name: /add vehicle/i });
}

async function fillCreateForm(dialog: HTMLElement): Promise<void> {
  const user = userEvent.setup();
  await user.type(within(dialog).getByLabelText(/^make$/i), 'Honda');
  await user.type(within(dialog).getByLabelText(/^model$/i), 'City');
  await user.type(within(dialog).getByLabelText(/^category$/i), 'Sedan');
  await user.type(within(dialog).getByLabelText(/^price$/i), '1500000');
  await user.type(within(dialog).getByLabelText(/^quantity$/i), '4');
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

describe('administrator vehicle controls', () => {
  it('shows administrator actions to ADMIN', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);

    expect(screen.getByRole('button', { name: /add vehicle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restock/i })).toBeInTheDocument();
  });

  it('hides every administrator action from USER', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('USER', vehicle);

    expect(screen.queryByRole('button', { name: /add vehicle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restock/i })).not.toBeInTheDocument();
  });
});

describe('administrator vehicle creation', () => {
  it('opens an accessible form and validates every required field', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);
    const dialog = await openAddVehicleForm();
    const user = userEvent.setup();

    expect(within(dialog).getByLabelText(/^make$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^model$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^category$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^price$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^quantity$/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /add vehicle/i }));

    expect(await within(dialog).findByText(/make is required/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/model is required/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/category is required/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/price is required/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/quantity is required/i)).toBeInTheDocument();
    expect(mutationRequests('POST', '/vehicles')).toHaveLength(0);
  });

  it('rejects blank text, zero price and negative quantity before creating', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);
    const dialog = await openAddVehicleForm();
    const user = userEvent.setup();

    await user.type(within(dialog).getByLabelText(/^make$/i), '   ');
    await user.type(within(dialog).getByLabelText(/^model$/i), '   ');
    await user.type(within(dialog).getByLabelText(/^category$/i), '   ');
    await user.type(within(dialog).getByLabelText(/^price$/i), '0');
    await user.type(within(dialog).getByLabelText(/^quantity$/i), '-1');
    await user.click(within(dialog).getByRole('button', { name: /add vehicle/i }));

    expect(
      await within(dialog).findByText(/make is required|make cannot be blank/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/model is required|model cannot be blank/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/category is required|category cannot be blank/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/price must be (?:greater than zero|positive)/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/quantity (?:cannot be negative|must be non-negative)/i),
    ).toBeInTheDocument();
    expect(mutationRequests('POST', '/vehicles')).toHaveLength(0);
  });

  it('rejects a negative price and decimal quantity before creating', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);
    const dialog = await openAddVehicleForm();
    const user = userEvent.setup();

    await user.type(within(dialog).getByLabelText(/^make$/i), 'Honda');
    await user.type(within(dialog).getByLabelText(/^model$/i), 'City');
    await user.type(within(dialog).getByLabelText(/^category$/i), 'Sedan');
    await user.type(within(dialog).getByLabelText(/^price$/i), '-10');
    await user.type(within(dialog).getByLabelText(/^quantity$/i), '1.5');
    await user.click(within(dialog).getByRole('button', { name: /add vehicle/i }));

    expect(
      await within(dialog).findByText(/price must be (?:greater than zero|positive)/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/quantity must be (?:a whole number|an integer)/i),
    ).toBeInTheDocument();
    expect(mutationRequests('POST', '/vehicles')).toHaveLength(0);
  });

  it('sends one valid create request and refreshes, closes and confirms after success', async () => {
    const existingVehicle = createVehicle();
    const createdVehicle = createVehicle({
      id: '34508f38-6a4f-4a5e-84b9-d2887f0ea4d9',
      make: 'Honda',
      model: 'City',
      category: 'Sedan',
      price: 1_500_000,
      quantity: 4,
    });
    const pendingCreate = deferredResponse();
    const api = installVehicleApi([existingVehicle], (request) =>
      request.method === 'POST' && request.url.endsWith('/vehicles')
        ? pendingCreate.promise
        : Promise.resolve(jsonResponse({}, 500)),
    );
    await renderCatalogue('ADMIN', existingVehicle);
    const dialog = await openAddVehicleForm();
    const user = userEvent.setup();
    await fillCreateForm(dialog);
    const submitButton = within(dialog).getByRole('button', { name: /add vehicle/i });

    await user.click(submitButton);
    await waitFor(() => {
      expect(mutationRequests('POST', '/vehicles')).toHaveLength(1);
    });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(mutationRequests('POST', '/vehicles')).toHaveLength(1);
    expect(mutationRequests('POST', '/vehicles')[0]).toMatchObject({
      authorization: 'Bearer admin-access-token',
      body: {
        make: 'Honda',
        model: 'City',
        category: 'Sedan',
        price: 1_500_000,
        quantity: 4,
      },
    });

    api.setVehicles([existingVehicle, createdVehicle]);
    pendingCreate.resolve(jsonResponse({ data: { vehicle: createdVehicle } }, 201));

    expect(await screen.findByRole('heading', { name: 'Honda City' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /add vehicle/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/vehicle added successfully/i)).toBeInTheDocument();
  });

  it('shows a safe backend validation error without closing the form', async () => {
    const internalDetail = 'Prisma query and database hostname';
    const vehicle = createVehicle();
    installVehicleApi([vehicle], (request) =>
      Promise.resolve(
        request.method === 'POST' && request.url.endsWith('/vehicles')
          ? jsonResponse(
              {
                error: {
                  code: 'VEHICLE_VALIDATION_FAILED',
                  message: 'Vehicle details are invalid.',
                  details: { internalDetail },
                },
              },
              400,
            )
          : jsonResponse({}, 500),
      ),
    );
    await renderCatalogue('ADMIN', vehicle);
    const dialog = await openAddVehicleForm();
    await fillCreateForm(dialog);
    const user = userEvent.setup();

    await user.click(within(dialog).getByRole('button', { name: /add vehicle/i }));

    expect(await within(dialog).findByText(/vehicle details are invalid/i)).toBeInTheDocument();
    expect(screen.queryByText(internalDetail)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /add vehicle/i })).toBeInTheDocument();
  });
});

describe('administrator vehicle updates', () => {
  it('populates the edit form, handles an unchanged form and allows cancellation', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const dialog = screen.getByRole('dialog', { name: /edit vehicle/i });

    expect(within(dialog).getByLabelText(/^make$/i)).toHaveValue('Toyota');
    expect(within(dialog).getByLabelText(/^model$/i)).toHaveValue('Fortuner');
    expect(within(dialog).getByLabelText(/^category$/i)).toHaveValue('SUV');
    expect(within(dialog).getByLabelText(/^price$/i)).toHaveValue(4_250_000);
    expect(within(dialog).getByLabelText(/^quantity$/i)).toHaveValue(3);
    expect(within(dialog).getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(mutationRequests('PUT', `/vehicles/${VEHICLE_ID}`)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog', { name: /edit vehicle/i })).not.toBeInTheDocument();
    expect(mutationRequests('PUT', `/vehicles/${VEHICLE_ID}`)).toHaveLength(0);
  });

  it('rejects invalid edited values before updating', async () => {
    const vehicle = createVehicle();
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const dialog = screen.getByRole('dialog', { name: /edit vehicle/i });

    await user.clear(within(dialog).getByLabelText(/^make$/i));
    await user.clear(within(dialog).getByLabelText(/^price$/i));
    await user.type(within(dialog).getByLabelText(/^price$/i), '0');
    await user.clear(within(dialog).getByLabelText(/^quantity$/i));
    await user.type(within(dialog).getByLabelText(/^quantity$/i), '1.5');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(await within(dialog).findByText(/make is required/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/price must be (?:greater than zero|positive)/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/quantity must be (?:a whole number|an integer)/i),
    ).toBeInTheDocument();
    expect(mutationRequests('PUT', `/vehicles/${VEHICLE_ID}`)).toHaveLength(0);
  });

  it('prevents duplicate pending updates and renders the updated vehicle after success', async () => {
    const vehicle = createVehicle();
    const updatedVehicle = createVehicle({ model: 'Legender' });
    const pendingUpdate = deferredResponse();
    const api = installVehicleApi([vehicle], (request) =>
      request.method === 'PUT' && request.url.endsWith(`/vehicles/${VEHICLE_ID}`)
        ? pendingUpdate.promise
        : Promise.resolve(jsonResponse({}, 500)),
    );
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const dialog = screen.getByRole('dialog', { name: /edit vehicle/i });
    const modelInput = within(dialog).getByLabelText(/^model$/i);
    await user.clear(modelInput);
    await user.type(modelInput, 'Legender');
    const saveButton = within(dialog).getByRole('button', { name: /save changes/i });

    await user.click(saveButton);
    await waitFor(() => {
      expect(mutationRequests('PUT', `/vehicles/${VEHICLE_ID}`)).toHaveLength(1);
    });
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(mutationRequests('PUT', `/vehicles/${VEHICLE_ID}`)).toHaveLength(1);
    const updateRequest = mutationRequests('PUT', `/vehicles/${VEHICLE_ID}`)[0];
    expect(updateRequest?.authorization).toBe('Bearer admin-access-token');
    expect(updateRequest?.body).toEqual(expect.objectContaining({ model: 'Legender' }));

    api.setVehicles([updatedVehicle]);
    pendingUpdate.resolve(jsonResponse({ data: { vehicle: updatedVehicle } }));

    expect(await screen.findByRole('heading', { name: 'Toyota Legender' })).toBeInTheDocument();
    expect(screen.getByText(/vehicle updated successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /edit vehicle/i })).not.toBeInTheDocument();
  });

  it('keeps the edit form safe when the backend reports a missing vehicle', async () => {
    const internalDetail = 'repository update stack trace';
    const vehicle = createVehicle();
    installVehicleApi([vehicle], (request) =>
      Promise.resolve(
        request.method === 'PUT'
          ? jsonResponse(
              {
                error: {
                  code: 'VEHICLE_NOT_FOUND',
                  message: 'Vehicle not found.',
                  details: { internalDetail },
                },
              },
              404,
            )
          : jsonResponse({}, 500),
      ),
    );
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const dialog = screen.getByRole('dialog', { name: /edit vehicle/i });
    const modelInput = within(dialog).getByLabelText(/^model$/i);
    await user.clear(modelInput);
    await user.type(modelInput, 'Legender');

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(
      await within(dialog).findByText(/vehicle (?:was )?not found|no longer available/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(internalDetail)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Toyota Fortuner' })).toBeInTheDocument();
  });
});

describe('administrator vehicle deletion', () => {
  it('requires accessible confirmation, supports cancellation and prevents duplicate deletion', async () => {
    const vehicle = createVehicle();
    const pendingDelete = deferredResponse();
    const api = installVehicleApi([vehicle], (request) =>
      request.method === 'DELETE' && request.url.endsWith(`/vehicles/${VEHICLE_ID}`)
        ? pendingDelete.promise
        : Promise.resolve(jsonResponse({}, 500)),
    );
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    let dialog = screen.getByRole('dialog', { name: /delete vehicle/i });
    expect(within(dialog).getByText(/Toyota Fortuner/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(mutationRequests('DELETE', `/vehicles/${VEHICLE_ID}`)).toHaveLength(0);
    expect(screen.queryByRole('dialog', { name: /delete vehicle/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    dialog = screen.getByRole('dialog', { name: /delete vehicle/i });
    const confirmButton = within(dialog).getByRole('button', { name: /delete vehicle/i });
    await user.click(confirmButton);
    await waitFor(() => {
      expect(mutationRequests('DELETE', `/vehicles/${VEHICLE_ID}`)).toHaveLength(1);
    });
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(mutationRequests('DELETE', `/vehicles/${VEHICLE_ID}`)).toHaveLength(1);
    expect(mutationRequests('DELETE', `/vehicles/${VEHICLE_ID}`)[0]?.authorization).toBe(
      'Bearer admin-access-token',
    );

    api.setVehicles([]);
    pendingDelete.resolve(new Response(null, { status: 204 }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Toyota Fortuner' })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/vehicle deleted successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /vehicle catalogue/i })).toHaveFocus();
  });

  it('handles a missing vehicle deletion without exposing backend details', async () => {
    const internalDetail = 'delete transaction stack trace';
    const vehicle = createVehicle();
    installVehicleApi([vehicle], (request) =>
      Promise.resolve(
        request.method === 'DELETE'
          ? jsonResponse(
              {
                error: {
                  code: 'VEHICLE_NOT_FOUND',
                  message: 'Vehicle not found.',
                  details: { internalDetail },
                },
              },
              404,
            )
          : jsonResponse({}, 500),
      ),
    );
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('dialog', { name: /delete vehicle/i });

    await user.click(within(dialog).getByRole('button', { name: /delete vehicle/i }));

    expect(
      await screen.findByText(/vehicle (?:was )?not found|no longer available/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(internalDetail)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Toyota Fortuner' })).toBeInTheDocument();
  });
});

describe('administrator restocking', () => {
  it('requires a positive integer restock quantity before sending a request', async () => {
    const vehicle = createVehicle({ quantity: 0 });
    installVehicleApi([vehicle]);
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /restock/i }));
    const dialog = screen.getByRole('dialog', { name: /restock vehicle/i });
    const quantityInput = within(dialog).getByLabelText(/restock quantity/i);
    const submitButton = within(dialog).getByRole('button', { name: /restock vehicle/i });

    await user.click(submitButton);
    expect(await within(dialog).findByText(/quantity is required/i)).toBeInTheDocument();

    for (const invalidQuantity of ['0', '-1']) {
      await user.clear(quantityInput);
      await user.type(quantityInput, invalidQuantity);
      await user.click(submitButton);
      expect(
        await within(dialog).findByText(/quantity must be (?:greater than zero|positive)/i),
      ).toBeInTheDocument();
    }

    await user.clear(quantityInput);
    await user.type(quantityInput, '1.5');
    await user.click(submitButton);
    expect(
      await within(dialog).findByText(/quantity must be (?:a whole number|an integer)/i),
    ).toBeInTheDocument();
    expect(mutationRequests('POST', `/vehicles/${VEHICLE_ID}/restock`)).toHaveLength(0);
  });

  it('sends one valid pending restock and updates quantity and status after success', async () => {
    const vehicle = createVehicle({ quantity: 0 });
    const restockedVehicle = createVehicle({ quantity: 5 });
    const pendingRestock = deferredResponse();
    const api = installVehicleApi([vehicle], (request) =>
      request.method === 'POST' && request.url.endsWith(`/vehicles/${VEHICLE_ID}/restock`)
        ? pendingRestock.promise
        : Promise.resolve(jsonResponse({}, 500)),
    );
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /restock/i }));
    const dialog = screen.getByRole('dialog', { name: /restock vehicle/i });
    await user.type(within(dialog).getByLabelText(/restock quantity/i), '5');
    const submitButton = within(dialog).getByRole('button', { name: /restock vehicle/i });

    await user.click(submitButton);
    await waitFor(() => {
      expect(mutationRequests('POST', `/vehicles/${VEHICLE_ID}/restock`)).toHaveLength(1);
    });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(mutationRequests('POST', `/vehicles/${VEHICLE_ID}/restock`)).toHaveLength(1);
    expect(mutationRequests('POST', `/vehicles/${VEHICLE_ID}/restock`)[0]).toMatchObject({
      authorization: 'Bearer admin-access-token',
      body: { quantity: 5 },
    });

    api.setVehicles([restockedVehicle]);
    pendingRestock.resolve(jsonResponse({ data: restockedVehicle }));

    expect(await screen.findByText(/quantity:\s*5/i)).toBeInTheDocument();
    expect(screen.getByText(/^in stock$/i)).toBeInTheDocument();
    expect(screen.getByText(/vehicle restocked successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /restock vehicle/i })).not.toBeInTheDocument();
  });

  it('keeps stock unchanged and hides internal details when restocking fails', async () => {
    const internalDetail = 'atomic update implementation detail';
    const vehicle = createVehicle({ quantity: 2 });
    installVehicleApi([vehicle], (request) =>
      Promise.resolve(
        request.url.endsWith(`/vehicles/${VEHICLE_ID}/restock`)
          ? jsonResponse(
              {
                error: {
                  code: 'VEHICLE_NOT_FOUND',
                  message: 'Vehicle not found.',
                  details: { internalDetail },
                },
              },
              404,
            )
          : jsonResponse({}, 500),
      ),
    );
    await renderCatalogue('ADMIN', vehicle);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /restock/i }));
    const dialog = screen.getByRole('dialog', { name: /restock vehicle/i });
    await user.type(within(dialog).getByLabelText(/restock quantity/i), '3');

    await user.click(within(dialog).getByRole('button', { name: /restock vehicle/i }));

    expect(
      await screen.findByText(/vehicle (?:was )?not found|no longer available/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(internalDetail)).not.toBeInTheDocument();
    expect(screen.getByText(/quantity:\s*2/i)).toBeInTheDocument();
  });
});
