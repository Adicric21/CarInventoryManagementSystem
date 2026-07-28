import { AuthError, emailAlreadyExistsError, unexpectedError } from '../domain/auth-errors.js';
import { toPublicUser, type PublicUser } from '../domain/auth-types.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import { DuplicateEmailPersistenceError, type UserRepository } from '../domain/user-repository.js';
import { parseRegistrationInput } from './auth-validation.js';

export interface RegisterUser {
  execute(input: unknown): Promise<PublicUser>;
}

export interface RegisterUserDependencies {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
}

export class RegisterUserService implements RegisterUser {
  constructor(private readonly dependencies: RegisterUserDependencies) {}

  async execute(input: unknown): Promise<PublicUser> {
    const validatedInput = parseRegistrationInput(input);

    try {
      const existingUser = await this.dependencies.userRepository.findByEmail(validatedInput.email);

      if (existingUser !== null) {
        throw emailAlreadyExistsError();
      }

      const passwordHash = await this.dependencies.passwordHasher.hash(validatedInput.password);
      const user = await this.dependencies.userRepository.create({
        name: validatedInput.name,
        email: validatedInput.email,
        passwordHash,
        role: 'USER',
      });

      return toPublicUser(user);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      if (error instanceof DuplicateEmailPersistenceError) {
        throw emailAlreadyExistsError();
      }

      throw unexpectedError();
    }
  }
}
