import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="Dealership introduction">
        <Link className="brand brand--light" to="/">
          <span className="brand__mark" aria-hidden="true">
            A
          </span>
          <span>Anand Motors</span>
        </Link>
        <div className="auth-showcase__content">
          <p className="eyebrow">Curated inventory. Confident decisions.</p>
          <h2>Find a vehicle that moves you forward.</h2>
          <p>
            Explore live dealership inventory, compare what matters, and purchase available stock
            through one clear experience.
          </p>
        </div>
        <p className="auth-showcase__note">Trusted inventory, updated in real time.</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-page-title">
        <div className="auth-card">
          <p className="eyebrow eyebrow--accent">{eyebrow}</p>
          <h1 id="auth-page-title">{title}</h1>
          <p className="auth-card__description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
