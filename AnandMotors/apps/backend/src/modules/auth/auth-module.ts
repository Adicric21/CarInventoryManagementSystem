import type { AuthDependencies } from './application/auth-dependencies.js';
import { LoginUserService } from './application/login-user.js';
import { RegisterUserService } from './application/register-user.js';
import { AuthController } from './http/auth-controller.js';
import { AuthenticationService } from './http/authenticate.js';
import { AuthorizationService } from './http/authorize.js';

export function createAuthModule(dependencies: AuthDependencies) {
  const registerUser = new RegisterUserService(dependencies);
  const loginUser = new LoginUserService(dependencies);

  return {
    api: new AuthController({ registerUser, loginUser }),
    authenticator: new AuthenticationService(dependencies.tokenProvider),
    authorizer: new AuthorizationService(),
  };
}
