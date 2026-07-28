import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient } from '../../lib/api/client.js';
import type { DashboardPeriod, Vehicle } from '../../lib/api/types.js';
import { RestockDialog } from '../vehicles/restock-dialog.js';
import { formatDecimalInr } from '../vehicles/vehicle-formatting.js';

const ACTION_LABELS = {
  VEHICLE_CREATED: 'Vehicle created',
  VEHICLE_UPDATED: 'Vehicle updated',
  VEHICLE_DELETED: 'Vehicle deleted',
  VEHICLE_PURCHASED: 'Vehicle purchased',
  VEHICLE_RESTOCKED: 'Vehicle restocked',
} as const;

const SUMMARY_LABELS = {
  vehicleCount: 'Total Vehicles',
  totalStockUnits: 'Total Stock Units',
  inventoryValue: 'Inventory Value',
  lowStockCount: 'Low Stock',
  outOfStockCount: 'Out of Stock',
  purchaseCount: 'Purchases',
  unitsPurchased: 'Units Purchased',
  purchaseRevenue: 'Purchase Revenue',
} as const;

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>();
  const dashboard = useQuery({
    queryKey: ['admin-dashboard', period],
    queryFn: () => apiClient.getAdminDashboard(period),
  });
  const lowStock = useQuery({
    queryKey: ['low-stock-vehicles', { page: 1, limit: 5 }],
    queryFn: () => apiClient.getLowStockVehicles({ page: 1, limit: 5 }),
  });

  function handleRestocked(): void {
    void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['low-stock-vehicles'] });
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-activities'] });
  }

  if (dashboard.isPending) {
    return (
      <main className="dashboard-page">
        <p className="activity-state" role="status">
          Loading dashboard...
        </p>
      </main>
    );
  }

  if (dashboard.isError) {
    return (
      <main className="dashboard-page">
        <section className="activity-state" role="alert">
          <h1>Unable to load dashboard</h1>
          <p>Inventory analytics could not be loaded.</p>
          <button type="button" onClick={() => void dashboard.refetch()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  const data = dashboard.data;
  const summaryEntries = Object.entries(SUMMARY_LABELS) as [keyof typeof SUMMARY_LABELS, string][];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Inventory intelligence</p>
          <h1>Administrator dashboard</h1>
          <p>Current inventory and purchase performance in one operational view.</p>
        </div>
        <label>
          Analytics period
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </label>
      </header>

      <section className="dashboard-summary" aria-label="Dashboard summary">
        {summaryEntries.map(([field, label]) => {
          const value = data.summary[field];
          const displayed =
            field === 'inventoryValue' || field === 'purchaseRevenue'
              ? formatDecimalInr(String(value))
              : value;
          return (
            <article key={field}>
              <p>{label}</p>
              <strong>{displayed}</strong>
            </article>
          );
        })}
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <h2>Vehicles by category</h2>
          {data.vehiclesByCategory.length === 0 ? (
            <p>No inventory categories yet.</p>
          ) : (
            <ul className="metric-list">
              {data.vehiclesByCategory.map((category) => (
                <li key={category.category}>
                  <strong>{category.category}</strong>
                  <span>
                    {category.vehicleCount} vehicles · {category.stockUnits} units
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel">
          <h2>Top purchased vehicles</h2>
          {data.topPurchasedVehicles.length === 0 ? (
            <p>No purchases in this period.</p>
          ) : (
            <ul className="metric-list">
              {data.topPurchasedVehicles.map((vehicle) => (
                <li key={`${vehicle.vehicleMake}-${vehicle.vehicleModel}`}>
                  <strong>
                    {vehicle.vehicleMake} {vehicle.vehicleModel}
                  </strong>
                  <span>
                    {vehicle.unitsPurchased} units · {formatDecimalInr(vehicle.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel dashboard-panel--wide">
          <h2>Purchases by day</h2>
          {data.purchasesByDay.length === 0 ? (
            <p>No purchases in this period.</p>
          ) : (
            <div className="activity-table-wrap">
              <table className="activity-table dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Purchases</th>
                    <th>Units</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchasesByDay.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.purchaseCount}</td>
                      <td>{day.unitsPurchased}</td>
                      <td>{formatDecimalInr(day.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <h2>Recent inventory activity</h2>
          {data.recentActivities.length === 0 ? (
            <p>No inventory activity yet.</p>
          ) : (
            <ul className="metric-list">
              {data.recentActivities.map((activity) => (
                <li key={activity.id}>
                  <strong>{ACTION_LABELS[activity.action]}</strong>
                  <span>
                    {activity.vehicleMake} {activity.vehicleModel} ·{' '}
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel">
          <h2>Low-stock quick restock</h2>
          {lowStock.isPending ? <p>Loading low-stock vehicles...</p> : null}
          {lowStock.isError ? <p>Unable to load low-stock vehicles.</p> : null}
          {lowStock.data?.data.length === 0 ? <p>No low-stock vehicles.</p> : null}
          <ul className="metric-list">
            {lowStock.data?.data.map((vehicle) => (
              <li key={vehicle.id}>
                <span>
                  <strong>
                    {vehicle.make} {vehicle.model}
                  </strong>{' '}
                  · {vehicle.quantity} remaining
                </span>
                <button type="button" onClick={() => setSelectedVehicle(vehicle)}>
                  Restock
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {selectedVehicle === undefined ? null : (
        <RestockDialog
          open
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(undefined)}
          onRestocked={handleRestocked}
        />
      )}
    </main>
  );
}
