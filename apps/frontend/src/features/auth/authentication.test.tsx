import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../app-root.js';

const SESSION_KEY = 'car-dealership-session';
const TEST_TOKEN = 'test-access-token';
const TEST_PASSWORD = 'StrongPassword123';

const registeredUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'USER',
} as const;

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

function defaultFetch(input: RequestInfo | URL): Promise<Response> {
  const url = requestUrl(input);

  if (url.includes('/api/auth/register')) {
    return Promise.resolve(jsonResponse({ data: { user: registeredUser } }, 201));
  }

  if (url.includes('/api/auth/login')) {
    return Promise.resolve(
      jsonResponse({ data: { accessToken: TEST_TOKEN, user: registeredUser } }),
    );
  }

  if (url.includes('/api/vehicles')) {
    return Promise.resolve(
      jsonResponse({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
    );
  }

  return Promise.resolve(
    jsonResponse({ error: { code: 'NOT_FOUND', message: 'Route not found.', details: {} } }, 404),
  );
}

function renderAt(path: string): void {
  window.history.replaceState({}, '', path);
  render(<App />);
}

function requestBodyFor(path: string): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([input]) => requestUrl(input).includes(path));
  expect(call, `Expected a request to ${path}`).toBeDefined();

  const body = call?.[1]?.body;
  expect(typeof body).toBe('string');
  return JSON.parse(body as string) as Record<string, unknown>;
}

async function fillRegistrationForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  } = {},
): Promise<void> {
  await user.type(screen.getByLabelText(/^name$/i), values.name ?? 'Ada Lovelace');
  await user.type(screen.getByLabelText(/^email$/i), values.email ?? 'ada@example.com');
  await user.type(screen.getByLabelText(/^password$/i), values.password ?? TEST_PASSWORD);
  await user.type(
    screen.getByLabelText(/confirm password/i),
    values.confirmPassword ?? TEST_PASSWORD,
  );
}

async function fillLoginForm(
  user: ReturnType<typeof userEvent.setup>,
  email = 'ada@example.com',
  password = TEST_PASSWORD,
): Promise<void> {
  await user.type(screen.getByLabelText(/^email$/i), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registration', () => {
  it('renders accessible account fields, a submit action, and a login link', async () => {
    const user = userEvent.setup();
    renderAt('/register');

    expect(screen.getByLabelText(/^name$/i)).toBeRequired();
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /create account|register/i })).toBeEnabled();

    await user.click(screen.getByRole('link', { name: /log in|sign in/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(screen.getByLabelText(/^email$/i)).toBeVisible();
  });

  it('shows field-level errors and does not submit when required values are missing', async () => {
    const user = userEvent.setup();
    renderAt('/register');

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/name is required/i)).toBeVisible();
    expect(screen.getByText(/email is required/i)).toBeVisible();
    expect(screen.getByText(/^password is required/i)).toBeVisible();
    expect(screen.getByText('Please confirm your password.')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid email before sending a request', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistrationForm(user, { email: 'not-an-email' });

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/valid email/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a weak password before sending a request', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistrationForm(user, { password: 'password', confirmPassword: 'password' });

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/uppercase.*lowercase.*number|strong password/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a mismatched password confirmation', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistrationForm(user, { confirmPassword: 'DifferentPassword123' });

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables the submit action while registration is pending', async () => {
    const user = userEvent.setup();
    let releaseRequest: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) => {
      if (requestUrl(input).includes('/api/auth/register')) {
        return new Promise<Response>((resolve) => {
          releaseRequest = resolve;
        });
      }

      return defaultFetch(input);
    });
    renderAt('/register');
    await fillRegistrationForm(user);

    const submit = screen.getByRole('button', { name: /create account|register/i });
    await user.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByText(/creating account|registering/i)).toBeVisible();

    releaseRequest?.(jsonResponse({ data: { user: registeredUser } }, 201));
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('sends normalized registration data without the confirmation password', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistrationForm(user, {
      name: '  Ada Lovelace  ',
      email: '  ADA@Example.COM  ',
    });

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestBodyFor('/api/auth/register')).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: TEST_PASSWORD,
    });
  });

  it('returns to login with useful feedback after successful registration', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await fillRegistrationForm(user);

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(await screen.findByText(/account created|registration successful/i)).toBeVisible();
  });

  it('displays safe backend validation feedback', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request is invalid.',
            details: { fields: { email: ['Email cannot be used.'] } },
          },
        },
        400,
      ),
    );
    renderAt('/register');
    await fillRegistrationForm(user);

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/request is invalid/i)).toBeVisible();
  });

  it('explains when an email address is already registered', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists.',
            details: {},
          },
        },
        409,
      ),
    );
    renderAt('/register');
    await fillRegistrationForm(user);

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/account with this email already exists/i)).toBeVisible();
  });

  it('does not expose internal backend details after a failed registration', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'UNEXPECTED_ERROR',
            message: 'An unexpected error occurred.',
            details: { stack: 'PrismaClientKnownRequestError at users.ts:41', sql: 'SELECT *' },
          },
        },
        500,
      ),
    );
    renderAt('/register');
    await fillRegistrationForm(user);

    await user.click(screen.getByRole('button', { name: /create account|register/i }));

    expect(await screen.findByText(/unexpected error|something went wrong/i)).toBeVisible();
    expect(screen.queryByText(/PrismaClientKnownRequestError/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SELECT \*/i)).not.toBeInTheDocument();
  });
});

describe('login', () => {
  it('renders accessible credentials, a submit action, and a registration link', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /log in|sign in/i })).toBeEnabled();

    await user.click(screen.getByRole('link', { name: /create account|register/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/register'));
    expect(screen.getByLabelText(/^name$/i)).toBeVisible();
  });

  it('shows required-field feedback without sending a login request', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeVisible();
    expect(screen.getByText(/password is required/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid login email before sending a request', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await fillLoginForm(user, 'invalid-email');

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables the login action while authentication is pending', async () => {
    const user = userEvent.setup();
    let releaseRequest: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) => {
      if (requestUrl(input).includes('/api/auth/login')) {
        return new Promise<Response>((resolve) => {
          releaseRequest = resolve;
        });
      }

      return defaultFetch(input);
    });
    renderAt('/login');
    await fillLoginForm(user);

    const submit = screen.getByRole('button', { name: /log in|sign in/i });
    await user.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByText(/signing in|logging in/i)).toBeVisible();

    releaseRequest?.(jsonResponse({ data: { accessToken: TEST_TOKEN, user: registeredUser } }));
    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
  });

  it('sends normalized credentials to the login endpoint', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await fillLoginForm(user, '  ADA@Example.COM  ');

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestBodyFor('/api/auth/login')).toEqual({
      email: 'ada@example.com',
      password: TEST_PASSWORD,
    });
  });

  it('stores a sanitized authenticated session after login', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    await waitFor(() => expect(window.localStorage.getItem(SESSION_KEY)).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? '{}')).toEqual({
      accessToken: TEST_TOKEN,
      user: registeredUser,
    });
  });

  it('navigates to the vehicle catalogue after login', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(
      await screen.findByRole('heading', { name: /vehicle catalogue|vehicle inventory/i }),
    ).toBeVisible();
  });

  it('shows generic invalid-credentials feedback', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
            details: {},
          },
        },
        401,
      ),
    );
    renderAt('/login');
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeVisible();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('never renders the submitted password or access token', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await fillLoginForm(user);

    await user.click(screen.getByRole('button', { name: /log in|sign in/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/vehicles'));
    expect(document.body).not.toHaveTextContent(TEST_PASSWORD);
    expect(document.body).not.toHaveTextContent(TEST_TOKEN);
  });
});
