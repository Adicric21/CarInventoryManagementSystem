import { Router, type Response } from 'express';

import type { TokenProvider } from '../../auth/domain/token-provider.js';
import { authenticate, authorize } from '../../auth/http/express-middleware.js';
import type { ApiResponse } from '../../../shared/http/error-response.js';
import type { VehicleController } from './vehicle-controller.js';

function sendResponse(response: Response, result: ApiResponse): void {
  if (result.status === 204) {
    response.status(204).send();
    return;
  }

  response.status(result.status).json(result.body);
}

function routeParameter(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function authenticatedUserId(request: { authenticatedUser?: { id: string } }): string {
  return request.authenticatedUser?.id ?? '';
}

export function createVehicleRouter(
  controller: VehicleController,
  tokenProvider: TokenProvider,
): Router {
  const router = Router();
  const requireAuthentication = authenticate(tokenProvider);
  const requireAdministrator = authorize('ADMIN');

  router.get('/search', requireAuthentication, async (request, response) => {
    sendResponse(response, await controller.search(request.query));
  });

  router.get('/', requireAuthentication, async (request, response) => {
    sendResponse(response, await controller.list(request.query));
  });

  router.post('/', requireAuthentication, requireAdministrator, async (request, response) => {
    const body: unknown = request.body;
    sendResponse(response, await controller.create(body, authenticatedUserId(request)));
  });

  router.post('/:id/purchase', requireAuthentication, async (request, response) => {
    const body: unknown = request.body;
    sendResponse(
      response,
      await controller.purchase(
        routeParameter(request.params['id']),
        body,
        authenticatedUserId(request),
      ),
    );
  });

  router.post(
    '/:id/restock',
    requireAuthentication,
    requireAdministrator,
    async (request, response) => {
      const body: unknown = request.body;
      sendResponse(
        response,
        await controller.restock(
          routeParameter(request.params['id']),
          body,
          authenticatedUserId(request),
        ),
      );
    },
  );

  router.put('/:id', requireAuthentication, requireAdministrator, async (request, response) => {
    const body: unknown = request.body;
    sendResponse(
      response,
      await controller.update(
        routeParameter(request.params['id']),
        body,
        authenticatedUserId(request),
      ),
    );
  });

  router.delete('/:id', requireAuthentication, requireAdministrator, async (request, response) => {
    sendResponse(
      response,
      await controller.delete(routeParameter(request.params['id']), authenticatedUserId(request)),
    );
  });

  return router;
}

export function createAdminVehicleRouter(
  controller: VehicleController,
  tokenProvider: TokenProvider,
): Router {
  const router = Router();

  router.get(
    '/low-stock',
    authenticate(tokenProvider),
    authorize('ADMIN'),
    async (request, response) => {
      sendResponse(response, await controller.lowStock(request.query));
    },
  );

  return router;
}
