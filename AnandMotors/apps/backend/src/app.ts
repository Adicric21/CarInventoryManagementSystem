import express, { type ErrorRequestHandler, type Express, type Router } from 'express';

import { validationError } from './modules/auth/domain/auth-errors.js';
import { createAuthRouter } from './modules/auth/http/auth-routes.js';
import { toErrorResponse } from './modules/auth/http/error-response.js';
import type { AuthApi } from './modules/auth/http/http-contracts.js';

function isInvalidJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    Reflect.get(error, 'status') === 400 &&
    Reflect.get(error, 'type') === 'entity.parse.failed'
  );
}

const invalidJsonHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (isInvalidJsonError(error)) {
    const result = toErrorResponse(
      validationError({ body: ['Request body must contain valid JSON.'] }),
    );
    response.status(result.status).json(result.body);
    return;
  }

  next(error);
};

const unexpectedErrorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
  const result = toErrorResponse(new Error('Unhandled application error'));
  response.status(result.status).json(result.body);
};

export function createApp(
  authApi: AuthApi,
  vehicleRouter?: Router,
  inventoryActivityRouter?: Router,
  adminVehicleRouter?: Router,
  purchaseRouter?: Router,
  adminPurchaseRouter?: Router,
  dashboardRouter?: Router,
  vehicleCsvRouter?: Router,
): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/auth', createAuthRouter(authApi));
  if (vehicleRouter !== undefined) {
    app.use('/api/vehicles', vehicleRouter);
  }
  if (inventoryActivityRouter !== undefined) {
    app.use('/api/admin/inventory', inventoryActivityRouter);
  }
  if (adminVehicleRouter !== undefined) {
    app.use('/api/admin/vehicles', adminVehicleRouter);
  }
  if (purchaseRouter !== undefined) {
    app.use('/api/purchases', purchaseRouter);
  }
  if (adminPurchaseRouter !== undefined) {
    app.use('/api/admin/purchases', adminPurchaseRouter);
  }
  if (dashboardRouter !== undefined) {
    app.use('/api/admin/dashboard', dashboardRouter);
  }
  if (vehicleCsvRouter !== undefined) {
    app.use('/api/admin/vehicles', vehicleCsvRouter);
  }
  app.use(invalidJsonHandler);
  app.use(unexpectedErrorHandler);

  return app;
}
