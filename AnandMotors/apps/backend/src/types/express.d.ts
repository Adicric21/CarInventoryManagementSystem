import type { AuthenticatedUserContext } from '../modules/auth/http/request-context.js';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUserContext;
    }
  }
}

export {};
