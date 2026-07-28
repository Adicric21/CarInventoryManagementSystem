export const USER_ROLES = ['USER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
