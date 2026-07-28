import { Router, type Response } from 'express';

import type { TokenProvider } from '../../auth/domain/token-provider.js';
import { authenticate, authorize } from '../../auth/http/express-middleware.js';
import type { ApiResponse } from '../../../shared/http/error-response.js';
import type { InventoryActivityController } from './inventory-activity-controller.js';

function sendResponse(response: Response, result: ApiResponse): void {
  response.status(result.status).json(result.body);
}

export function createInventoryActivityRouter(
  controller: InventoryActivityController,
  tokenProvider: TokenProvider,
): Router {
  const router = Router();

  router.get(
    '/activities',
    authenticate(tokenProvider),
    authorize('ADMIN'),
    async (request, response) => {
      sendResponse(response, await controller.list(request.query));
    },
  );

  return router;
}
