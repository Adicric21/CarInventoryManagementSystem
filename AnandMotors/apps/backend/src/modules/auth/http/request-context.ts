export interface AuthenticatedUserContext {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedContext {
  user: AuthenticatedUserContext;
}
