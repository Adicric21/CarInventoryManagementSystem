import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../app-root.js';

const SESSION_STORAGE_KEY = 'car-dealership-session';
const ACCESS_TOKEN = 'catalogue-test-access-token';

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

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface VehiclePage {
  data: Vehicle[];
  meta: PaginationMeta;
}

const vehicleFixture: Vehicle = {
  id: 'f45366d4-86a9-4c96-b8a7-e5de5eeb7a4a',
  make: 'Toyota',
  model: 'Fortuner',
  category: 'SUV',
  price: 3_500_000,
  quantity: 5,
  stockStatus: 'IN_STOCK',
  isLowStock: false,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
};

function createVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const quantity = overrides.quantity ?? vehicleFixture.quantity;
  const stockState =
    quantity === 0
      ? { stockStatus: 'OUT_OF_STOCK' as const, isLowStock: true }
      : quantity <= 3
        ? { stockStatus: 'LOW_STOCK' as const, isLowStock: true }
        : { stockStatus: 'IN_STOCK' as const, isLowStock: false };
  return { ...vehicleFixture, ...stockState, ...overrides };
}

function createVehiclePage(
  data: Vehicle[] = [createVehicle()],
  meta: Partial<PaginationMeta> = {},
): VehiclePage {
  return {
    data,
    meta: {
      page: 1,
      limit: 10,
      total: data.length,
      totalPages: data.length === 0 ? 0 : 1,
      ...meta,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type ResponseFactory = () => Response | Promise<Response>;

function installFetch(...responses: ResponseFactory[]) {
  const fetchMock = vi.fn<typeof fetch>();

  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => Promise.resolve(response()));
  }

  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(createVehiclePage())));
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function createDeferredResponse() {
  let resolveResponse: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve(response: Response) {
      if (resolveResponse === undefined) {
        throw new Error('The deferred response was not initialized.');
      }

      resolveResponse(response);
    },
  };
}

function seedSession(role: UserRole): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      accessToken: ACCESS_TOKEN,
      user: {
        id: 'a8804f8a-922b-4f31-bf82-1f33334174d7',
        name: role === 'ADMIN' ? 'Aarav Administrator' : 'Diya Driver',
        email: role === 'ADMIN' ? 'aarav@example.com' : 'diya@example.com',
        role,
      },
    }),
  );
}

function renderCatalogue(role: UserRole = 'USER'): void {
  seedSession(role);
  window.history.replaceState({}, '', '/vehicles');
  render(<App />);
}

function requestUrl(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, callIndex = -1): URL {
  const call = fetchMock.mock.calls.at(callIndex);

  if (call === undefined) {
    throw new Error('Expected a vehicle API request.');
  }

  const input = call[0];
  const value = input instanceof Request ? input.url : String(input);
  return new URL(value, window.location.origin);
}

async function waitForRequestCount(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  count: number,
): Promise<void> {
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });
}

async function waitForCatalogue(): Promise<void> {
  expect(await screen.findByText(vehicleFixture.model)).toBeInTheDocument();
}

async function applyFilters(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: /apply filters|search vehicles/i }));
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('vehicle catalogue states and content', () => {
  it('shows an accessible loading state while vehicles load', async () => {
    const pending = createDeferredResponse();
    installFetch(() => pending.promise);

    renderCatalogue();

    expect(await screen.findByText(/loading vehicles/i)).toBeInTheDocument();
    pending.resolve(jsonResponse(createVehiclePage()));
    await waitForCatalogue();
  });

  it('renders each vehicle make and model', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue();

    expect(await screen.findByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Fortuner')).toBeInTheDocument();
  });

  it('renders the vehicle category', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue();

    expect(await screen.findByText('SUV')).toBeInTheDocument();
  });

  it('formats vehicle prices as Indian rupees', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue();

    expect(await screen.findByText(/₹\s?35,00,000(?:\.00)?/u)).toBeInTheDocument();
  });

  it('renders the available vehicle quantity', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue();

    expect(await screen.findByText(/5 (?:units? )?available/i)).toBeInTheDocument();
  });

  it('identifies a vehicle that is in stock', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue();

    expect(await screen.findByText(/^in stock$/i)).toBeInTheDocument();
  });

  it('identifies a vehicle that is out of stock', async () => {
    installFetch(() => jsonResponse(createVehiclePage([createVehicle({ quantity: 0 })])));

    renderCatalogue();

    expect(await screen.findByText(/^out of stock$/i)).toBeInTheDocument();
  });

  it('renders a useful empty inventory state', async () => {
    installFetch(() => jsonResponse(createVehiclePage([])));

    renderCatalogue();

    expect(await screen.findByText(/no vehicles available/i)).toBeInTheDocument();
  });

  it('renders a recoverable error state when loading fails', async () => {
    installFetch(() =>
      jsonResponse(
        { error: { code: 'UNEXPECTED_ERROR', message: 'Unexpected error.', details: {} } },
        500,
      ),
    );

    renderCatalogue();

    expect(await screen.findByText(/unable to load vehicles/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries the vehicle request after a loading error', async () => {
    const fetchMock = installFetch(
      () =>
        jsonResponse(
          { error: { code: 'UNEXPECTED_ERROR', message: 'Unexpected error.', details: {} } },
          500,
        ),
      () => jsonResponse(createVehiclePage()),
    );
    renderCatalogue();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /retry/i }));

    await waitForCatalogue();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not expose internal API failure details', async () => {
    const internalDetail = 'Prisma connection failed at inventory-db.internal:5432';
    installFetch(() =>
      jsonResponse(
        {
          error: {
            code: 'UNEXPECTED_ERROR',
            message: 'Unexpected error.',
            details: { internalDetail },
          },
        },
        500,
      ),
    );

    renderCatalogue();

    expect(await screen.findByText(/unable to load vehicles/i)).toBeInTheDocument();
    expect(screen.queryByText(internalDetail)).not.toBeInTheDocument();
  });

  it('hides administrator vehicle controls from a USER', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue('USER');
    await waitForCatalogue();

    expect(screen.queryByRole('button', { name: /add vehicle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^restock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete/i })).not.toBeInTheDocument();
  });

  it('shows administrator vehicle controls to an ADMIN', async () => {
    installFetch(() => jsonResponse(createVehiclePage()));

    renderCatalogue('ADMIN');
    await waitForCatalogue();

    expect(screen.getByRole('button', { name: /add vehicle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^restock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete/i })).toBeInTheDocument();
  });
});

describe('vehicle search and filters', () => {
  it('searches by make', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('make')).toBe('Toyota');
  });

  it('searches by model', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^model$/i), 'Fortuner');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('model')).toBe('Fortuner');
  });

  it('filters by category', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^category$/i), 'SUV');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('category')).toBe('SUV');
  });

  it('filters by minimum price', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/minimum price/i), '2500000');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('minPrice')).toBe('2500000');
  });

  it('filters by maximum price', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/maximum price/i), '4000000');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('maxPrice')).toBe('4000000');
  });

  it('filters to in-stock vehicles', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.click(screen.getByRole('checkbox', { name: /in stock only/i }));
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('inStock')).toBe('true');
  });

  it('combines all supported filters in one request', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await user.type(screen.getByLabelText(/^model$/i), 'Fortuner');
    await user.type(screen.getByLabelText(/^category$/i), 'SUV');
    await user.type(screen.getByLabelText(/minimum price/i), '2500000');
    await user.type(screen.getByLabelText(/maximum price/i), '4000000');
    await user.click(screen.getByRole('checkbox', { name: /in stock only/i }));
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(Object.fromEntries(requestUrl(fetchMock).searchParams)).toMatchObject({
      make: 'Toyota',
      model: 'Fortuner',
      category: 'SUV',
      minPrice: '2500000',
      maxPrice: '4000000',
      inStock: 'true',
    });
  });

  it('clears filter controls and removes filter query parameters', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await user.type(screen.getByLabelText(/^category$/i), 'SUV');
    await user.click(screen.getByRole('checkbox', { name: /in stock only/i }));
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    await waitForRequestCount(fetchMock, 3);

    expect(screen.getByLabelText(/^make$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^category$/i)).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /in stock only/i })).not.toBeChecked();
    expect(requestUrl(fetchMock).searchParams.has('make')).toBe(false);
    expect(requestUrl(fetchMock).searchParams.has('category')).toBe(false);
    expect(requestUrl(fetchMock).searchParams.has('inStock')).toBe(false);
  });

  it('shows a no-results state for filters with no matches', async () => {
    installFetch(
      () => jsonResponse(createVehiclePage()),
      () => jsonResponse(createVehiclePage([])),
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^make$/i), 'Unobtainium');
    await applyFilters();

    expect(await screen.findByText(/no vehicles match your filters/i)).toBeInTheDocument();
  });

  it('preserves entered filter values while refreshed results load', async () => {
    const pending = createDeferredResponse();
    installFetch(
      () => jsonResponse(createVehiclePage()),
      () => pending.promise,
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await user.type(screen.getByLabelText(/minimum price/i), '2500000');
    await applyFilters();

    expect(screen.getByLabelText(/^make$/i)).toHaveValue('Toyota');
    expect(screen.getByLabelText(/minimum price/i)).toHaveValue(2_500_000);
    expect(await screen.findByText(/updating vehicles/i)).toBeInTheDocument();
    pending.resolve(jsonResponse(createVehiclePage()));
    await waitForCatalogue();
  });

  it('does not submit a minimum price above the maximum price', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/minimum price/i), '5000000');
    await user.type(screen.getByLabelText(/maximum price/i), '1000000');
    await applyFilters();

    expect(
      await screen.findByText(/minimum price must not exceed maximum price/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends only query parameters supported by the backend', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await user.type(screen.getByLabelText(/^category$/i), 'SUV');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    const url = requestUrl(fetchMock);
    const supportedParameters = new Set([
      'make',
      'model',
      'category',
      'minPrice',
      'maxPrice',
      'inStock',
      'page',
      'limit',
      'sortBy',
      'sortOrder',
    ]);

    expect(url.pathname).toBe('/api/vehicles/search');
    expect([...url.searchParams.keys()].every((key) => supportedParameters.has(key))).toBe(true);
    expect(url.searchParams.has('role')).toBe(false);
    expect(url.searchParams.has('accessToken')).toBe(false);
  });

  it('shows loading feedback while filters refresh the catalogue', async () => {
    const pending = createDeferredResponse();
    installFetch(
      () => jsonResponse(createVehiclePage()),
      () => pending.promise,
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.type(screen.getByLabelText(/^model$/i), 'Fortuner');
    await applyFilters();

    expect(await screen.findByText(/updating vehicles/i)).toBeInTheDocument();
    expect(screen.getByText('Fortuner')).toBeInTheDocument();
    pending.resolve(jsonResponse(createVehiclePage()));
    await waitForCatalogue();
  });
});

describe('vehicle sorting and pagination', () => {
  it('changes the vehicle sort field', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'price');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('sortBy')).toBe('price');
  });

  it('changes between ascending and descending sort direction', async () => {
    const fetchMock = installFetch(() => jsonResponse(createVehiclePage()));
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.selectOptions(screen.getByLabelText(/sort direction/i), 'asc');
    await applyFilters();
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('sortOrder')).toBe('asc');
  });

  it('navigates to the next page', async () => {
    const fetchMock = installFetch(
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 25, totalPages: 3 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 2, total: 25, totalPages: 3 })),
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.click(screen.getByRole('button', { name: /next page/i }));
    await waitForRequestCount(fetchMock, 2);

    expect(requestUrl(fetchMock).searchParams.get('page')).toBe('2');
    expect(await screen.findByText(/page 2 of 3/i)).toBeInTheDocument();
  });

  it('navigates back to the previous page', async () => {
    const fetchMock = installFetch(
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 25, totalPages: 3 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 2, total: 25, totalPages: 3 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 25, totalPages: 3 })),
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();
    await user.click(screen.getByRole('button', { name: /next page/i }));
    await screen.findByText(/page 2 of 3/i);

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    await waitForRequestCount(fetchMock, 3);

    expect(requestUrl(fetchMock).searchParams.get('page')).toBe('1');
    expect(await screen.findByText(/page 1 of 3/i)).toBeInTheDocument();
  });

  it('disables the previous-page action on the first page', async () => {
    installFetch(() =>
      jsonResponse(createVehiclePage(undefined, { page: 1, total: 25, totalPages: 3 })),
    );

    renderCatalogue();
    await waitForCatalogue();

    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('disables the next-page action on the last page', async () => {
    installFetch(() =>
      jsonResponse(createVehiclePage(undefined, { page: 1, total: 1, totalPages: 1 })),
    );

    renderCatalogue();
    await waitForCatalogue();

    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('displays the current page and total page count', async () => {
    installFetch(() =>
      jsonResponse(createVehiclePage(undefined, { page: 1, total: 42, totalPages: 5 })),
    );

    renderCatalogue();

    expect(await screen.findByText(/page 1 of 5/i)).toBeInTheDocument();
  });

  it('resets to page one when filters change', async () => {
    const fetchMock = installFetch(
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 25, totalPages: 3 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 2, total: 25, totalPages: 3 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 4, totalPages: 1 })),
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();
    await user.click(screen.getByRole('button', { name: /next page/i }));
    await screen.findByText(/page 2 of 3/i);

    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await applyFilters();
    await waitForRequestCount(fetchMock, 3);

    expect(requestUrl(fetchMock).searchParams.get('page')).toBe('1');
  });

  it('preserves active filters while changing pages', async () => {
    const fetchMock = installFetch(
      () => jsonResponse(createVehiclePage()),
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 15, totalPages: 2 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 2, total: 15, totalPages: 2 })),
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();
    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await applyFilters();
    await screen.findByText(/page 1 of 2/i);

    await user.click(screen.getByRole('button', { name: /next page/i }));
    await waitForRequestCount(fetchMock, 3);

    expect(requestUrl(fetchMock).searchParams.get('page')).toBe('2');
    expect(requestUrl(fetchMock).searchParams.get('make')).toBe('Toyota');
    expect(screen.getByLabelText(/^make$/i)).toHaveValue('Toyota');
  });

  it('handles an empty later page without trapping the user', async () => {
    const fetchMock = installFetch(
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 11, totalPages: 2 })),
      () => jsonResponse(createVehiclePage([], { page: 2, total: 10, totalPages: 2 })),
      () => jsonResponse(createVehiclePage(undefined, { page: 1, total: 10, totalPages: 1 })),
    );
    renderCatalogue();
    const user = userEvent.setup();
    await waitForCatalogue();

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(
      await screen.findByText(/no vehicles (?:found|available) on this page/i),
    ).toBeInTheDocument();
    const previousPage = screen.getByRole('button', { name: /previous page/i });
    expect(previousPage).toBeEnabled();
    await user.click(previousPage);
    await waitForRequestCount(fetchMock, 3);

    expect(await screen.findByText('Fortuner')).toBeInTheDocument();
    expect(requestUrl(fetchMock).searchParams.get('page')).toBe('1');
  });
});
