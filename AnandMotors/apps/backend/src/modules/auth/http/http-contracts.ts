import type { AuthenticatedContext, AuthenticatedUserContext } from './request-context.js';
import type { UserRole } from '../domain/auth-types.js';

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers?: Readonly<Record<string, string>>;
  query?: Readonly<Record<string, string>>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface AuthApi {
  request(request: ApiRequest): Promise<ApiResponse>;
}

export type AuthenticationResult =
  | { response: ApiResponse; context?: never }
  | { context: AuthenticatedContext; response?: never };

export interface Authenticator {
  authenticate(request: ApiRequest): Promise<AuthenticationResult>;
}

export interface AuthorizationInput {
  context?: AuthenticatedContext;
  request: ApiRequest;
  requiredRole: UserRole;
}

export interface AuthorizationResult {
  allowed: boolean;
  response?: ApiResponse;
}

export interface Authorizer {
  authorize(input: AuthorizationInput): Promise<AuthorizationResult>;
}

export type { AuthenticatedContext, AuthenticatedUserContext };
