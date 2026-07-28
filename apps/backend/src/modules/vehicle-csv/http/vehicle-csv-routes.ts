import { Router, type Response } from 'express';

import { toErrorResponse, type ApiResponse } from '../../../shared/http/error-response.js';
import type { TokenProvider } from '../../auth/domain/token-provider.js';
import { authenticate, authorize } from '../../auth/http/express-middleware.js';
import type { VehicleCsvController } from './vehicle-csv-controller.js';
import { readCsvUpload } from './multipart-csv.js';

function send(response: Response, result: ApiResponse): void {
  response.status(result.status).json(result.body);
}

export function createVehicleCsvRouter(
  controller: VehicleCsvController,
  tokenProvider: TokenProvider,
) {
  const router = Router();
  const adminOnly = [authenticate(tokenProvider), authorize('ADMIN')] as const;

  router.post('/import/preview', ...adminOnly, async (request, response) => {
    try {
      send(response, controller.preview(await readCsvUpload(request)));
    } catch (error) {
      send(response, toErrorResponse(error));
    }
  });
  router.post('/import', ...adminOnly, async (request, response) => {
    try {
      send(
        response,
        await controller.import(await readCsvUpload(request), request.authenticatedUser?.id ?? ''),
      );
    } catch (error) {
      send(response, toErrorResponse(error));
    }
  });
  router.get('/export', ...adminOnly, async (_request, response) => {
    const result = await controller.export();
    if (result.status !== 200 || typeof result.body !== 'string') {
      send(response, result);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    response
      .status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="vehicles-${date}.csv"`)
      .send(result.body);
  });
  return router;
}
