import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { UserRole } from '../domain/auth-types.js';
import type { TokenProvider } from '../domain/token-provider.js';
import { AuthenticationService } from './authenticate.js';
import { AuthorizationService } from './authorize.js';
import type { ApiRequest, ApiResponse } from './http-contracts.js';

function asApiRequest(request: Request): ApiRequest {
  const authorization = request.get('authorization');
  const headers = authorization === undefined ? undefined : { authorization };
  const method =
    request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE'
      ? request.method
      : 'GET';
  const body: unknown = request.body;

  return {
    method,
    path: request.path,
    ...(headers === undefined ? {} : { headers }),
    body,
  };
}

function sendApiResponse(response: Response, result: ApiResponse): void {
  response.status(result.status).json(result.body);
}

export function authenticate(tokenProvider: TokenProvider): RequestHandler {
  const authenticator = new AuthenticationService(tokenProvider);

  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const result = await authenticator.authenticate(asApiRequest(request));

    if (result.response !== undefined) {
      sendApiResponse(response, result.response);
      return;
    }

    request.authenticatedUser = result.context.user;
    next();
  };
}

export function authorize(requiredRole: UserRole): RequestHandler {
  const authorizer = new AuthorizationService();

  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const context =
      request.authenticatedUser === undefined ? undefined : { user: request.authenticatedUser };
    const result = await authorizer.authorize({
      ...(context === undefined ? {} : { context }),
      request: asApiRequest(request),
      requiredRole,
    });

    if (!result.allowed && result.response !== undefined) {
      sendApiResponse(response, result.response);
      return;
    }

    next();
  };
}
