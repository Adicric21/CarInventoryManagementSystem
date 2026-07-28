import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { apiClient, getErrorMessage } from '../../lib/api/client.js';
import { AuthShell } from './auth-shell.js';

const passwordMessage =
  'Password must be at least 8 characters and include uppercase, lowercase, and number characters.';

const registrationSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(100, 'Name is too long.'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required.')
      .email('Please enter a valid email address.'),
    password: z
      .string()
      .min(1, 'Password is required.')
      .min(8, passwordMessage)
      .regex(/[A-Z]/, passwordMessage)
      .regex(/[a-z]/, passwordMessage)
      .regex(/[0-9]/, passwordMessage),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type RegistrationValues = z.infer<typeof registrationSchema>;

interface FieldErrorProps {
  id: string;
  message?: string;
}

function FieldError({ id, message }: FieldErrorProps) {
  return message === undefined ? null : (
    <span className="field-error" id={id} role="alert">
      {message}
    </span>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationValues>({ resolver: zodResolver(registrationSchema) });

  const submit = handleSubmit(async (values) => {
    setRequestError(null);

    try {
      await apiClient.register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      void navigate('/login', {
        replace: true,
        state: { notice: 'Account created successfully. You can now sign in.' },
      });
    } catch (error) {
      setRequestError(getErrorMessage(error, 'Something went wrong. Please try again.'));
    }
  });

  return (
    <AuthShell
      eyebrow="Join the showroom"
      title="Create your account"
      description="Set up your profile to explore and purchase from our current inventory."
    >
      {requestError === null ? null : (
        <div className="feedback feedback--error" role="alert">
          {requestError}
        </div>
      )}

      <form
        className="auth-form"
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="field">
          <label htmlFor="registration-name">Name</label>
          <input
            id="registration-name"
            type="text"
            required
            autoComplete="name"
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name === undefined ? undefined : 'registration-name-error'}
            {...register('name')}
          />
          <FieldError id="registration-name-error" message={errors.name?.message} />
        </div>

        <div className="field">
          <label htmlFor="registration-email">Email</label>
          <input
            id="registration-email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email === undefined ? undefined : 'registration-email-error'}
            {...register('email')}
          />
          <FieldError id="registration-email-error" message={errors.email?.message} />
        </div>

        <div className="field">
          <label htmlFor="registration-password">Password</label>
          <input
            id="registration-password"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={errors.password !== undefined}
            aria-describedby={
              errors.password === undefined ? undefined : 'registration-password-error'
            }
            {...register('password')}
          />
          <FieldError id="registration-password-error" message={errors.password?.message} />
        </div>

        <div className="field">
          <label htmlFor="registration-confirm-password">Confirm password</label>
          <input
            id="registration-confirm-password"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword !== undefined}
            aria-describedby={
              errors.confirmPassword === undefined
                ? undefined
                : 'registration-confirm-password-error'
            }
            {...register('confirmPassword')}
          />
          <FieldError
            id="registration-confirm-password-error"
            message={errors.confirmPassword?.message}
          />
        </div>

        <button
          className="button button--primary button--wide"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="auth-card__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
