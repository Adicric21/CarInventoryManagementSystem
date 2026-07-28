import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient } from '../../lib/api/client.js';
import type { Vehicle, VehiclePage } from '../../lib/api/types.js';
import { formatInr } from './vehicle-formatting.js';
import { RestockDialog } from './restock-dialog.js';

const PAGE_SIZE = 20;
const LOW_STOCK_QUERY_KEY = ['low-stock-vehicles'] as const;

export function LowStockPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>();
  const queryKey = [...LOW_STOCK_QUERY_KEY, { page, limit: PAGE_SIZE }] as const;
  const vehicles = useQuery({
    queryKey,
    queryFn: () => apiClient.getLowStockVehicles({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const result = vehicles.data;
  const totalPages = Math.max(1, result?.meta.totalPages ?? 1);

  function handleRestocked(vehicle: Vehicle): void {
    queryClient.setQueryData<VehiclePage>(queryKey, (current) => {
      if (current === undefined) {
        return current;
      }

      const data = vehicle.isLowStock
        ? current.data.map((existing) => (existing.id === vehicle.id ? vehicle : existing))
        : current.data.filter((existing) => existing.id !== vehicle.id);
      const removed = data.length < current.data.length;
      const total = removed ? Math.max(0, current.meta.total - 1) : current.meta.total;

      return {
        data,
        meta: {
          ...current.meta,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / current.meta.limit),
        },
      };
    });
    void queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-activities'] });
  }

  return (
    <main className="low-stock-page">
      <header className="low-stock-page__header">
        <p className="eyebrow">Inventory attention</p>
        <h1>Low-stock vehicles</h1>
        <p>Vehicles shown here use the threshold configured by the server.</p>
      </header>

      {vehicles.isPending && result === undefined ? (
        <p className="activity-state" role="status">
          Loading low-stock vehicles...
        </p>
      ) : null}

      {vehicles.isError && result === undefined ? (
        <section className="activity-state" role="alert">
          <h2>Unable to load low-stock vehicles</h2>
          <p>The inventory alert list could not be loaded.</p>
          <button type="button" onClick={() => void vehicles.refetch()}>
            Retry
          </button>
        </section>
      ) : null}

      {result?.data.length === 0 ? (
        <section className="activity-state">
          <h2>No low-stock vehicles</h2>
          <p>Every vehicle is currently above the configured threshold.</p>
        </section>
      ) : null}

      {result !== undefined && result.data.length > 0 ? (
        <section className="low-stock-grid" aria-label="Low-stock vehicles">
          {result.data.map((vehicle) => (
            <article className="low-stock-card" key={vehicle.id}>
              <div>
                <p className="vehicle-card__category">{vehicle.category}</p>
                <h2>
                  {vehicle.make} {vehicle.model}
                </h2>
                <p>{formatInr(vehicle.price)}</p>
              </div>
              <div>
                <p>Quantity: {vehicle.quantity}</p>
                <p
                  className={`stock-status ${
                    vehicle.stockStatus === 'OUT_OF_STOCK'
                      ? 'stock-status--out'
                      : 'stock-status--low'
                  }`}
                >
                  {vehicle.stockStatus === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock'}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Restock ${vehicle.make} ${vehicle.model}`}
                onClick={() => setSelectedVehicle(vehicle)}
              >
                Quick restock
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {result === undefined ? null : (
        <nav className="pagination" aria-label="Low-stock vehicle pages">
          <button
            type="button"
            disabled={page <= 1 || vehicles.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <p>
            Page {result.meta.page} of {totalPages} - {result.meta.total} results
          </p>
          <button
            type="button"
            disabled={vehicles.isFetching || result.meta.totalPages === 0 || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}

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
