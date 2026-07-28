import type { PasswordHasher } from '../domain/password-hasher.js';
import type { TokenProvider } from '../domain/token-provider.js';
import type { UserRepository } from '../domain/user-repository.js';

export interface AuthDependencies {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  tokenProvider: TokenProvider;
}
