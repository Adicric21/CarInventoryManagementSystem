import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiClient, UNAUTHORIZED_EVENT } from '../../lib/api/client.js';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from '../../lib/auth/session-storage.js';
import type { AuthSession, LoginInput } from '../../lib/api/types.js';
import { AuthContext, type AuthContextValue } from './auth-context.js';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const login = useCallback(async (input: LoginInput): Promise<void> => {
    const authenticatedSession = await apiClient.login(input);
    writeStoredSession(authenticatedSession);
    setSessionMessage(null);
    setSession(authenticatedSession);
  }, []);

  const logout = useCallback((): void => {
    clearStoredSession();
    setSessionMessage(null);
    setSession(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = (): void => {
      if (session !== null) {
        setSessionMessage('Your session has expired. Please sign in again.');
      }

      setSession(null);
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      role: session?.user.role ?? null,
      isSessionLoading: false,
      sessionMessage,
      login,
      logout,
    }),
    [login, logout, session, sessionMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
