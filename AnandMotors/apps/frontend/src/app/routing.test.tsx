import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app-root.js';
import { apiClient } from '../lib/api/client.js';
import { clearStoredSession } from '../lib/auth/session-storage.js';

const SESSION_KEY = 'car-dealership-session';
const TEST_TOKEN = 'persisted-access-token';

type Role = 'USER' | 'ADMIN';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}

function storeSession(role: Role, accessToken = TEST_TOKEN): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken,
      user: {
        id: role === 'ADMIN' ? 'admin-1' : 'user-1',
        name: role === 'ADMIN' ? 'Asha Admin' : 'Uma User',
        email: role === 'ADMIN' ? 'asha@example.com' : 'uma@example.com',
        role,
      },
    }),
  );
}

function renderAt(path: string): void {
  window.history.replaceState({}, '', path);
  render(<App />);
}

function vehicleRequest(): Parameters<typeof fetch> | undefined {
  return fetchMock.mock.calls.find(([input]) => requestUrl(input).includes('/api/vehicles'));
}

beforeEach(() => {
  clearStoredSession();
  window.history.replaceState({}, '', '/');
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    jsonResponse({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('session-aware routing', () => {
  it('redirects an unauthenticated visitor from the vehicle catalogue to login', async () => {
    renderAt('/vehicles');

    expect(
      await screen.findByRole('heading', { name: /welcome back|log in|sign in/i }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(
      screen.queryByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).not.toBeInTheDocument();
  });

  it('allows an authenticated user to load the catalogue with its bearer session', async () => {
    storeSession('USER');
    renderAt('/vehicles');

    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
    await waitFor(() => expect(vehicleRequest()).toBeDefined());

    const headers = new Headers(vehicleRequest()?.[1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('allows an authenticated administrator to open the add-vehicle route', async () => {
    storeSession('ADMIN');
    renderAt('/admin/vehicles/new');

    expect(await screen.findByRole('heading', { name: /add vehicle|new vehicle/i })).toBeVisible();
    expect(screen.getByLabelText(/^make$/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /add vehicle|create vehicle/i })).toBeEnabled();
  });

  it('shows the activity navigation only to administrators', async () => {
    storeSession('ADMIN');
    renderAt('/vehicles');

    expect(await screen.findByRole('link', { name: 'Activity' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Low Stock' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Import/Export' })).toBeVisible();
  });

  it('keeps a normal user out of the administrator-only route', async () => {
    storeSession('USER');
    renderAt('/admin/vehicles/new');

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(
      screen.queryByRole('heading', { name: /add vehicle|new vehicle/i }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
  });

  it('keeps a normal user out of the activity route and hides its navigation', async () => {
    storeSession('USER');
    renderAt('/admin/inventory/activity');

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(screen.queryByRole('link', { name: 'Activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Low Stock' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import/Export' })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
  });

  it('keeps a normal user out of the low-stock route', async () => {
    storeSession('USER');
    renderAt('/admin/vehicles/low-stock');

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { name: /low-stock vehicles/i })).not.toBeInTheDocument();
  });

  it('keeps a normal user out of the administrator dashboard', async () => {
    storeSession('USER');
    renderAt('/admin/dashboard');

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
  });

  it('keeps a normal user out of vehicle import and export', async () => {
    storeSession('USER');
    renderAt('/admin/inventory/import-export');

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(screen.queryByRole('link', { name: 'Import/Export' })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
  });

  it('restores the sanitized user and role from storage after a page refresh', async () => {
    storeSession('ADMIN');
    renderAt('/vehicles');

    expect(await screen.findByText('Asha Admin')).toBeVisible();
    expect(screen.getByText(/^admin$/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /log out|sign out/i })).toBeVisible();
    expect(window.location.pathname).toBe('/vehicles');
  });

  it('rejects a persisted JWT that is already expired before showing protected content', async () => {
    const expiredPayload = btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1_000) - 60 }),
    ).replaceAll('=', '');
    storeSession('ADMIN', `header.${expiredPayload}.signature`);

    renderAt('/admin/vehicles/new');

    expect(await screen.findByLabelText(/^email$/i)).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns to login when the active session expires while the application is open', async () => {
    const initialTime = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(initialTime);
    const futurePayload = btoa(
      JSON.stringify({ exp: Math.floor(initialTime / 1_000) + 60 }),
    ).replaceAll('=', '');
    storeSession('USER', `header.${futurePayload}.signature`);
    renderAt('/vehicles');
    const user = userEvent.setup();

    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
    now.mockReturnValue(initialTime + 120_000);
    await user.type(screen.getByLabelText(/^make$/i), 'Toyota');
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(await screen.findByLabelText(/^email$/i)).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    now.mockRestore();
  });

  it('clears the session and returns to login when the user logs out', async () => {
    const user = userEvent.setup();
    storeSession('USER');
    renderAt('/vehicles');

    await user.click(await screen.findByRole('button', { name: /log out|sign out/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(screen.getByLabelText(/^email$/i)).toBeVisible();
  });

  it('returns to login with safe feedback when the backend rejects the session', async () => {
    storeSession('USER');
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication is required.',
            details: { token: TEST_TOKEN, reason: 'signature verification failed' },
          },
        },
        401,
      ),
    );
    renderAt('/vehicles');

    expect(await screen.findByLabelText(/^email$/i)).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByText(/session.*expired|sign in again/i)).toBeVisible();
    expect(document.body).not.toHaveTextContent(TEST_TOKEN);
    expect(document.body).not.toHaveTextContent(/signature verification failed/i);
  });

  it('clears invalid persisted authentication after an API 401 response', async () => {
    storeSession('ADMIN');
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication is required.', details: {} } },
        401,
      ),
    );
    renderAt('/vehicles');

    await waitFor(() => expect(window.localStorage.getItem(SESSION_KEY)).toBeNull());
    expect(await screen.findByLabelText(/^email$/i)).toBeVisible();
    expect(window.location.pathname).toBe('/login');
  });

  it('does not let a stale 401 response clear a newer authenticated session', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    storeSession('USER', 'first-session-token');
    const staleRequest = apiClient.searchVehicles();
    storeSession('ADMIN', 'new-session-token');

    resolveRequest?.(
      jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } },
        401,
      ),
    );

    await expect(staleRequest).rejects.toMatchObject({ status: 401 });
    expect(JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? '{}')).toMatchObject({
      accessToken: 'new-session-token',
      user: { role: 'ADMIN' },
    });
  });

  it('fails closed without crashing when browser storage reads are blocked', async () => {
    const storageRead = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError');
    });

    renderAt('/vehicles');

    expect(await screen.findByLabelText(/^email$/i)).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(fetchMock).not.toHaveBeenCalled();
    storageRead.mockRestore();
  });

  it('renders a useful not-found page for an unknown route', async () => {
    renderAt('/route-that-does-not-exist');

    expect(await screen.findByRole('heading', { name: /page not found|not found/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /home|catalogue|login/i })).toBeVisible();
  });

  it('does not flash or request protected content while resolving an unauthenticated route', async () => {
    renderAt('/admin/vehicles/new');

    expect(
      screen.queryByRole('heading', { name: /add vehicle|new vehicle/i }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByLabelText(/^email$/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a successful login usable when browser storage writes are blocked', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError');
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            accessToken: 'memory-only-token',
            user: {
              id: 'user-memory',
              name: 'Memory User',
              email: 'memory@example.com',
              role: 'USER',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      );

    await user.type(screen.getByLabelText(/^email$/i), 'memory@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPassword123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
    expect(screen.getByText('Memory User')).toBeVisible();
    expect(window.location.pathname).toBe('/vehicles');
    storageWrite.mockRestore();
  });
});
