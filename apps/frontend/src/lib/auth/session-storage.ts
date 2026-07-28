import type { AuthSession, User } from '../api/types.js';

export const SESSION_STORAGE_KEY = 'car-dealership-session';

let memorySession: AuthSession | null = null;
let persistenceUnavailable = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    (value.role === 'USER' || value.role === 'ADMIN')
  );
}

function sanitizeSession(session: AuthSession): AuthSession {
  return {
    accessToken: session.accessToken,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
  };
}

function isStoredSession(value: unknown): value is AuthSession {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    value.accessToken !== '' &&
    isUser(value.user)
  );
}

function isExpiredJwt(accessToken: string): boolean {
  const segments = accessToken.split('.');
  if (segments.length !== 3 || segments[1] === undefined) {
    return false;
  }

  try {
    const normalizedPayload = segments[1].replaceAll('-', '+').replaceAll('_', '/');
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '=',
    );
    const payload: unknown = JSON.parse(window.atob(paddedPayload));
    return (
      isRecord(payload) &&
      typeof payload.exp === 'number' &&
      Number.isFinite(payload.exp) &&
      payload.exp * 1_000 <= Date.now()
    );
  } catch {
    return false;
  }
}

function removePersistedSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    persistenceUnavailable = false;
  } catch {
    persistenceUnavailable = true;
  }
}

export function readStoredSession(): AuthSession | null {
  if (persistenceUnavailable) {
    if (memorySession !== null && isExpiredJwt(memorySession.accessToken)) {
      memorySession = null;
    }

    return memorySession;
  }

  let stored: string | null;
  try {
    stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    persistenceUnavailable = true;
    return memorySession;
  }

  if (stored === null) {
    memorySession = null;
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (isStoredSession(parsed) && !isExpiredJwt(parsed.accessToken)) {
      memorySession = sanitizeSession(parsed);
      return memorySession;
    }
  } catch {
    // Invalid browser storage is treated as signed out.
  }

  memorySession = null;
  removePersistedSession();
  return null;
}

export function readStoredAccessToken(): {
  accessToken: string | null;
  sessionInvalidated: boolean;
} {
  const hadSession = memorySession !== null;
  const session = readStoredSession();

  return {
    accessToken: session?.accessToken ?? null,
    sessionInvalidated: hadSession && session === null,
  };
}

export function writeStoredSession(session: AuthSession): void {
  memorySession = sanitizeSession(session);

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(memorySession));
    persistenceUnavailable = false;
  } catch {
    persistenceUnavailable = true;
  }
}

export function clearStoredSession(expectedAccessToken?: string): boolean {
  const currentSession = readStoredSession();
  if (expectedAccessToken !== undefined && currentSession?.accessToken !== expectedAccessToken) {
    return false;
  }

  memorySession = null;
  removePersistedSession();
  return true;
}
