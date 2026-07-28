import { z } from 'zod';

import { validationError } from '../domain/auth-errors.js';
import type { LoginInput, RegistrationInput } from '../domain/auth-types.js';
import { fitsBcryptPasswordLimit } from '../domain/password-policy.js';

const registrationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name is too long.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(320, 'Email is too long.')
    .email('Email must be valid.'),
  password: z
    .string()
    .min(8, 'Password must contain at least 8 characters.')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
    .regex(/[a-z]/, 'Password must contain a lowercase letter.')
    .regex(/[0-9]/, 'Password must contain a number.')
    .refine(fitsBcryptPasswordLimit, 'Password is too long.'),
});

const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(320, 'Email is too long.')
      .email('Email must be valid.'),
    password: z
      .string()
      .min(1, 'Password is required.')
      .refine(fitsBcryptPasswordLimit, 'Password is too long.'),
  })
  .strict();

function validationDetails(error: z.ZodError): Readonly<Record<string, unknown>> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    const key = typeof field === 'string' ? field : 'body';
    const messages = fields[key] ?? [];
    messages.push(issue.message);
    fields[key] = messages;
  }

  return { fields };
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw validationError(validationDetails(result.error));
  }

  return result.data;
}

export function parseRegistrationInput(
  input: unknown,
): Pick<RegistrationInput, 'name' | 'email' | 'password'> {
  return parse(registrationSchema, input);
}

export function parseLoginInput(input: unknown): LoginInput {
  return parse(loginSchema, input);
}
