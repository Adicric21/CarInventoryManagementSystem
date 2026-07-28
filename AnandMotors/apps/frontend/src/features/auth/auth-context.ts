import { createContext, useContext } from 'react';

import type { AuthSession, LoginInput, User, UserRole } from '../../lib/api/types.js';

export interface AuthContextValue {
  session: AuthSession | null;
  user: User | null;
  accessToken: string | null;
  role: UserRole | null;
  isSessionLoading: boolean;
  sessionMessage: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
