import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient } from '../../lib/api/client.js';
import type { InventoryActivityAction, InventoryActivityQuery } from '../../lib/api/types.js';

const PAGE_SIZE = 20;
const ACTION_LABELS: Record<InventoryActivityAction, string> = {
  VEHICLE_CREATED: 'Vehicle created',
  VEHICLE_UPDATED: 'Vehicle updated',
  VEHICLE_DELETED: 'Vehicle deleted',
  VEHICLE_PURCHASED: 'Vehicle purchased',
  VEHICLE_RESTOCKED: 'Vehicle restocked',
};

function quantity(value: number | null): string {
  return value === null ? '—' : String(value);
}

function quantityChange(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return value > 0 ? `+${value}` : String(value);
}

export function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<InventoryActivityAction | ''>('');
  const [vehicleId, setVehicleId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query: InventoryActivityQuery = {
    page,
    limit: PAGE_SIZE,
    ...(action === '' ? {} : { action }),
    ...(vehicleId.trim() === '' ? {} : { vehicleId: vehicleId.trim() }),
    ...(from === '' ? {} : { from: new Date(`${from}T00:00:00.000Z`).toISOString() }),
    ...(to === '' ? {} : { to: new Date(`${to}T23:59:59.999Z`).toISOString() }),
  };
  const activities = useQuery({
    queryKey: ['inventory-activities', query],
    queryFn: () => apiClient.getInventoryActivities(query),
    placeholderData: keepPreviousData,
  });
  const result = activities.data;
  const totalPages = Math.max(1, result?.meta.totalPages ?? 1);

  return (
    <main className="activity-page">
      <header className="activity-page__header">
        <p className="eyebrow">Inventory intelligence</p>
        <h1>Inventory activity</h1>
        <p>An append-only history of stock and vehicle-management changes.</p>
      </header>

      <section className="activity-filters" aria-label="Activity filters">
        <label>
          Action
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value as InventoryActivityAction | '');
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vehicle ID
          <input
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            onBlur={() => setPage(1)}
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </section>

      {activities.isPending && result === undefined ? (
        <p className="activity-state" role="status">
          Loading inventory activity...
        </p>
      ) : null}

      {activities.isError && result === undefined ? (
        <section className="activity-state" role="alert">
          <h2>Unable to load activity</h2>
          <p>The inventory history could not be loaded.</p>
          <button type="button" onClick={() => void activities.refetch()}>
            Retry
          </button>
        </section>
      ) : null}

      {result?.data.length === 0 ? (
        <section className="activity-state">
          <h2>No inventory activity</h2>
          <p>No events match the selected filters.</p>
        </section>
      ) : null}

      {result !== undefined && result.data.length > 0 ? (
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th scope="col">Date and time</th>
                <th scope="col">Action</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Before</th>
                <th scope="col">Change</th>
                <th scope="col">After</th>
                <th scope="col">Performed by</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((activity) => (
                <tr key={activity.id}>
                  <td>{new Date(activity.createdAt).toLocaleString()}</td>
                  <td>{ACTION_LABELS[activity.action]}</td>
                  <td>
                    <strong>
                      {activity.vehicleMake} {activity.vehicleModel}
                    </strong>
                    <small>{activity.vehicleCategory}</small>
                  </td>
                  <td>{quantity(activity.quantityBefore)}</td>
                  <td>{quantityChange(activity.quantityChange)}</td>
                  <td>{quantity(activity.quantityAfter)}</td>
                  <td>
                    <strong>{activity.performedBy.name}</strong>
                    <small>{activity.performedBy.email}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result === undefined ? null : (
        <nav className="pagination" aria-label="Inventory activity pages">
          <button
            type="button"
            disabled={page <= 1 || activities.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <p>
            Page {result.meta.page} of {totalPages} - {result.meta.total} results
          </p>
          <button
            type="button"
            disabled={activities.isFetching || result.meta.totalPages === 0 || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
