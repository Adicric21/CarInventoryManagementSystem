import { Router } from 'express';

import type { AuthApi } from './http-contracts.js';

export function createAuthRouter(authApi: AuthApi): Router {
  const router = Router();

  router.post('/register', async (request, response) => {
    const body: unknown = request.body;
    const result = await authApi.request({
      method: 'POST',
      path: '/api/auth/register',
      body,
    });

    response.status(result.status).json(result.body);
  });

  router.post('/login', async (request, response) => {
    const body: unknown = request.body;
    const result = await authApi.request({
      method: 'POST',
      path: '/api/auth/login',
      body,
    });

    response.status(result.status).json(result.body);
  });

  return router;
}
