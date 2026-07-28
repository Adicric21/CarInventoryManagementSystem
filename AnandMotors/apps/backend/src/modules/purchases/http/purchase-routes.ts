import { Router, type Response } from 'express';

import type { TokenProvider } from '../../auth/domain/token-provider.js';
import { authenticate, authorize } from '../../auth/http/express-middleware.js';
import type { ApiResponse } from '../../../shared/http/error-response.js';
import type { PurchaseController } from './purchase-controller.js';

function send(response: Response, result: ApiResponse): void {
  response.status(result.status).json(result.body);
}

export function createPurchaseRouters(
  controller: PurchaseController,
  tokenProvider: TokenProvider,
) {
  const router = Router();
  const adminRouter = Router();
  const authenticated = authenticate(tokenProvider);

  router.get('/me', authenticated, async (request, response) => {
    send(response, await controller.mine(request.authenticatedUser?.id ?? '', request.query));
  });
  adminRouter.get('/', authenticated, authorize('ADMIN'), async (request, response) => {
    send(response, await controller.all(request.query));
  });
  return { router, adminRouter };
}
