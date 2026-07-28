import { AuthError, invalidCredentialsError, unexpectedError } from '../domain/auth-errors.js';
import { toPublicUser, type PublicUser } from '../domain/auth-types.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import type { TokenProvider } from '../domain/token-provider.js';
import type { UserRepository } from '../domain/user-repository.js';
import { parseLoginInput } from './auth-validation.js';

// A valid fixed hash keeps unknown-user and wrong-password verification paths comparable.
const DUMMY_PASSWORD_HASH = '$2b$12$5/ak.0CvVoLq4NHW6gfGteX0LkIZLin4YXmM3PMaNQxegI.D2Qnvm';

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

export interface LoginUser {
  execute(input: unknown): Promise<LoginResult>;
}

export interface LoginUserDependencies {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  tokenProvider: TokenProvider;
}

export class LoginUserService implements LoginUser {
  constructor(private readonly dependencies: LoginUserDependencies) {}

  async execute(input: unknown): Promise<LoginResult> {
    const validatedInput = parseLoginInput(input);

    try {
      const user = await this.dependencies.userRepository.findByEmail(validatedInput.email);

      if (user === null) {
        await this.dependencies.passwordHasher.verify(validatedInput.password, DUMMY_PASSWORD_HASH);
        throw invalidCredentialsError();
      }

      const passwordIsValid = await this.dependencies.passwordHasher.verify(
        validatedInput.password,
        user.passwordHash,
      );

      if (!passwordIsValid) {
        throw invalidCredentialsError();
      }

      const accessToken = await this.dependencies.tokenProvider.generate({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return { accessToken, user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw unexpectedError();
    }
  }
}
