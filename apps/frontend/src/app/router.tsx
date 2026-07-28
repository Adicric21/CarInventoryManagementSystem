import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { LoginPage } from '../features/auth/login-page.js';
import { RegisterPage } from '../features/auth/register-page.js';
import { useAuth } from '../features/auth/auth-context.js';
import { DashboardPage } from '../features/dashboard/dashboard-page.js';
import { ActivityLogPage } from '../features/inventory-activity/activity-log-page.js';
import { PurchaseHistoryPage } from '../features/purchases/purchase-history-page.js';
import { NewVehiclePage } from '../features/vehicles/admin-vehicle-actions.js';
import { CataloguePage } from '../features/vehicles/catalogue-page.js';
import { LowStockPage } from '../features/vehicles/low-stock-page.js';
import { VehicleCsvPage } from '../features/vehicle-csv/vehicle-csv-page.js';

function TitledPage({ children, title }: { children: ReactNode; title: string }) {
  useEffect(() => {
    document.title = `${title} | Anand Motors`;
  }, [title]);

  return <>{children}</>;
}

function ProtectedRoute() {
  const location = useLocation();
  const { isSessionLoading, session } = useAuth();

  if (isSessionLoading) {
    return (
      <main className="page-state" aria-live="polite">
        <p>Restoring your session...</p>
      </main>
    );
  }

  return session === null ? (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  ) : (
    <Outlet />
  );
}

function PublicOnlyRoute() {
  const { isSessionLoading, session } = useAuth();

  if (isSessionLoading) {
    return (
      <main className="page-state" aria-live="polite">
        <p>Restoring your session...</p>
      </main>
    );
  }

  return session === null ? <Outlet /> : <Navigate to="/vehicles" replace />;
}

function AdministratorRoute() {
  const { role } = useAuth();
  return role === 'ADMIN' ? <Outlet /> : <Navigate to="/vehicles" replace />;
}

function AuthenticatedLayout() {
  const { logout, role, user } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" to="/vehicles" aria-label="Anand Motors vehicle catalogue">
          <span className="brand__mark" aria-hidden="true">
            V
          </span>
          <span>
            Anand Motors
            <small>Inventory studio</small>
          </span>
        </Link>

        <nav className="app-nav" aria-label="Primary navigation">
          <Link to="/vehicles">Catalogue</Link>
          {role === 'USER' ? <Link to="/purchases">My Purchases</Link> : null}
          {role === 'ADMIN' ? <Link to="/admin/dashboard">Dashboard</Link> : null}
          {role === 'ADMIN' ? <Link to="/admin/inventory/activity">Activity</Link> : null}
          {role === 'ADMIN' ? <Link to="/admin/vehicles/low-stock">Low Stock</Link> : null}
          {role === 'ADMIN' ? <Link to="/admin/purchases">Purchases</Link> : null}
          {role === 'ADMIN' ? <Link to="/admin/inventory/import-export">Import/Export</Link> : null}
        </nav>

        <div className="account-menu">
          <span className="account-menu__identity">
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </span>
          <button className="button button--ghost" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function HomeRoute() {
  const { session } = useAuth();
  return <Navigate to={session === null ? '/login' : '/vehicles'} replace />;
}

function NotFoundPage() {
  const { session } = useAuth();

  return (
    <main className="not-found">
      <p className="eyebrow eyebrow--accent">404 - Wrong turn</p>
      <h1>Page not found</h1>
      <p>The page you requested is not in our showroom.</p>
      <Link className="button button--primary" to={session === null ? '/login' : '/vehicles'}>
        {session === null ? 'Return to login' : 'Return to catalogue'}
      </Link>
    </main>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />

      <Route element={<PublicOnlyRoute />}>
        <Route
          path="/login"
          element={
            <TitledPage title="Sign in">
              <LoginPage />
            </TitledPage>
          }
        />
        <Route
          path="/register"
          element={
            <TitledPage title="Create account">
              <RegisterPage />
            </TitledPage>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route
            path="/vehicles"
            element={
              <TitledPage title="Vehicle catalogue">
                <CataloguePage />
              </TitledPage>
            }
          />
          <Route
            path="/purchases"
            element={
              <TitledPage title="My purchases">
                <PurchaseHistoryPage mode="personal" />
              </TitledPage>
            }
          />
          <Route element={<AdministratorRoute />}>
            <Route
              path="/admin/inventory/import-export"
              element={
                <TitledPage title="Vehicle import and export">
                  <VehicleCsvPage />
                </TitledPage>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <TitledPage title="Administrator dashboard">
                  <DashboardPage />
                </TitledPage>
              }
            />
            <Route
              path="/admin/purchases"
              element={
                <TitledPage title="Purchase history">
                  <PurchaseHistoryPage mode="admin" />
                </TitledPage>
              }
            />
            <Route
              path="/admin/vehicles/low-stock"
              element={
                <TitledPage title="Low-stock vehicles">
                  <LowStockPage />
                </TitledPage>
              }
            />
            <Route
              path="/admin/inventory/activity"
              element={
                <TitledPage title="Inventory activity">
                  <ActivityLogPage />
                </TitledPage>
              }
            />
            <Route
              path="/admin/vehicles/new"
              element={
                <TitledPage title="Add vehicle">
                  <NewVehiclePage />
                </TitledPage>
              }
            />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <TitledPage title="Page not found">
            <NotFoundPage />
          </TitledPage>
        }
      />
    </Routes>
  );
}
