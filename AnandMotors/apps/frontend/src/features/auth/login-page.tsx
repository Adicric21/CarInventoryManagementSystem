import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { getErrorMessage } from '../../lib/api/client.js';
import { AuthShell } from './auth-shell.js';
import { useAuth } from './auth-context.js';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginValues = z.infer<typeof loginSchema>;

function stateValue(state: unknown, key: 'from' | 'notice'): string | null {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return null;
  }

  const value = (state as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, sessionMessage } = useAuth();
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const routeNotice = stateValue(location.state, 'notice');

  const submit = handleSubmit(async (values) => {
    setRequestError(null);

    try {
      await login(values);
      const intendedPath = stateValue(location.state, 'from');
      void navigate(intendedPath?.startsWith('/') === true ? intendedPath : '/vehicles', {
        replace: true,
      });
    } catch (error) {
      setRequestError(getErrorMessage(error, 'Unable to sign in. Please try again.'));
    }
  });

  return (
    <AuthShell
      eyebrow="Member access"
      title="Welcome back"
      description="Sign in to browse live stock and manage your dealership experience."
    >
      {routeNotice === null ? null : (
        <div className="feedback feedback--success" role="status">
          {routeNotice}
        </div>
      )}
      {sessionMessage === null ? null : (
        <div className="feedback feedback--warning" role="status">
          {sessionMessage}
        </div>
      )}
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
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email === undefined ? undefined : 'login-email-error'}
            {...register('email')}
          />
          {errors.email?.message === undefined ? null : (
            <span className="field-error" id="login-email-error" role="alert">
              {errors.email.message}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={errors.password !== undefined}
            aria-describedby={errors.password === undefined ? undefined : 'login-password-error'}
            {...register('password')}
          />
          {errors.password?.message === undefined ? null : (
            <span className="field-error" id="login-password-error" role="alert">
              {errors.password.message}
            </span>
          )}
        </div>

        <button
          className="button button--primary button--wide"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="auth-card__switch">
        New to Anand Motors? <Link to="/register">Create account</Link>
      </p>
    </AuthShell>
  );
}
