import { Router, type Response } from 'express';

import type { ApiResponse } from '../../../shared/http/error-response.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import { authenticate, authorize } from '../../auth/http/express-middleware.js';
import type { DashboardController } from './dashboard-controller.js';

function send(response: Response, result: ApiResponse): void {
  response.status(result.status).json(result.body);
}

export function createDashboardRouter(
  controller: DashboardController,
  tokenProvider: TokenProvider,
) {
  const router = Router();
  router.get('/', authenticate(tokenProvider), authorize('ADMIN'), async (request, response) => {
    send(response, await controller.show(request.query));
  });
  return router;
}
