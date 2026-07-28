import type {
  AuthApi,
  AuthDependencies,
  Authenticator,
  Authorizer,
  LoginUser,
  RegisterUser,
} from './auth-contracts.js';
import { LoginUserService } from '../application/login-user.js';
import { RegisterUserService } from '../application/register-user.js';
import { AuthController } from '../http/auth-controller.js';
import { AuthenticationService } from '../http/authenticate.js';
import { AuthorizationService } from '../http/authorize.js';

export class MissingAuthenticationBehaviourError extends Error {
  constructor(behaviour: string) {
    super(`${behaviour} is not implemented`);
    this.name = 'MissingAuthenticationBehaviourError';
  }
}

export function createRegisterUserSubject(dependencies: AuthDependencies): RegisterUser {
  return new RegisterUserService(dependencies);
}

export function createLoginUserSubject(dependencies: AuthDependencies): LoginUser {
  return new LoginUserService(dependencies);
}

export function createAuthApiSubject(dependencies: AuthDependencies): AuthApi {
  return new AuthController({
    registerUser: new RegisterUserService(dependencies),
    loginUser: new LoginUserService(dependencies),
  });
}

export function createAuthenticatorSubject(
  tokenProvider: AuthDependencies['tokenProvider'],
): Authenticator {
  return new AuthenticationService(tokenProvider);
}

export function createAuthorizerSubject(): Authorizer {
  return new AuthorizationService();
}
