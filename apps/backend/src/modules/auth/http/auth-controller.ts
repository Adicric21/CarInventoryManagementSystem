import type { LoginUser } from '../application/login-user.js';
import type { RegisterUser } from '../application/register-user.js';
import type { AuthApi, ApiRequest, ApiResponse } from './http-contracts.js';
import { toErrorResponse } from './error-response.js';

export interface AuthControllerDependencies {
  registerUser: RegisterUser;
  loginUser: LoginUser;
}

export class AuthController implements AuthApi {
  constructor(private readonly dependencies: AuthControllerDependencies) {}

  async request(request: ApiRequest): Promise<ApiResponse> {
    try {
      if (request.method === 'POST' && request.path === '/api/auth/register') {
        const user = await this.dependencies.registerUser.execute(request.body);
        return { status: 201, body: { data: { user } } };
      }

      if (request.method === 'POST' && request.path === '/api/auth/login') {
        const result = await this.dependencies.loginUser.execute(request.body);
        return { status: 200, body: { data: result } };
      }

      return {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Route not found.', details: {} } },
      };
    } catch (error) {
      return toErrorResponse(error);
    }
  }
}
