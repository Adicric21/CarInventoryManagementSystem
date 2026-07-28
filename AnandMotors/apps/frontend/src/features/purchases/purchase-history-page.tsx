import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient } from '../../lib/api/client.js';
import type { PurchaseQuery } from '../../lib/api/types.js';
import { formatDecimalInr } from '../vehicles/vehicle-formatting.js';

const PAGE_SIZE = 20;

export function PurchaseHistoryPage({ mode }: { mode: 'personal' | 'admin' }) {
  const [page, setPage] = useState(1);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query: PurchaseQuery = {
    page,
    limit: PAGE_SIZE,
    ...(make.trim() === '' ? {} : { make: make.trim() }),
    ...(model.trim() === '' ? {} : { model: model.trim() }),
    ...(mode === 'admin' && userId.trim() !== '' ? { userId: userId.trim() } : {}),
    ...(from === '' ? {} : { from: new Date(`${from}T00:00:00.000Z`).toISOString() }),
    ...(to === '' ? {} : { to: new Date(`${to}T23:59:59.999Z`).toISOString() }),
  };
  const purchases = useQuery({
    queryKey: ['purchases', mode, query],
    queryFn: () =>
      mode === 'admin' ? apiClient.getAdminPurchases(query) : apiClient.getMyPurchases(query),
    placeholderData: keepPreviousData,
  });
  const result = purchases.data;
  const totalPages = Math.max(1, result?.meta.totalPages ?? 1);

  return (
    <main className="activity-page purchase-page">
      <header className="activity-page__header">
        <p className="eyebrow">Purchase records</p>
        <h1>{mode === 'admin' ? 'Purchase history' : 'My purchases'}</h1>
        <p>
          {mode === 'admin'
            ? 'Review completed purchases across every customer.'
            : 'Review your completed vehicle purchases.'}
        </p>
      </header>

      <section className="activity-filters" aria-label="Purchase filters">
        <label>
          Make
          <input
            value={make}
            onChange={(event) => {
              setMake(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Model
          <input
            value={model}
            onChange={(event) => {
              setModel(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {mode === 'admin' ? (
          <label>
            User ID
            <input
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setPage(1);
              }}
            />
          </label>
        ) : null}
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

      {purchases.isPending && result === undefined ? (
        <p className="activity-state" role="status">
          Loading purchases...
        </p>
      ) : null}
      {purchases.isError && result === undefined ? (
        <section className="activity-state" role="alert">
          <h2>Unable to load purchases</h2>
          <p>The purchase history could not be loaded.</p>
          <button type="button" onClick={() => void purchases.refetch()}>
            Retry
          </button>
        </section>
      ) : null}
      {result?.data.length === 0 ? (
        <section className="activity-state">
          <h2>No purchases found</h2>
          <p>No completed purchases match the selected filters.</p>
        </section>
      ) : null}

      {result !== undefined && result.data.length > 0 ? (
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th scope="col">Purchased</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Unit price</th>
                <th scope="col">Quantity</th>
                <th scope="col">Total</th>
                {mode === 'admin' ? <th scope="col">Customer</th> : null}
              </tr>
            </thead>
            <tbody>
              {result.data.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{new Date(purchase.purchasedAt).toLocaleString()}</td>
                  <td>
                    <strong>
                      {purchase.vehicleMake} {purchase.vehicleModel}
                    </strong>
                    <small>{purchase.vehicleCategory}</small>
                  </td>
                  <td>{formatDecimalInr(purchase.unitPrice)}</td>
                  <td>{purchase.quantity}</td>
                  <td>
                    <strong>{formatDecimalInr(purchase.totalAmount)}</strong>
                  </td>
                  {mode === 'admin' ? (
                    <td>
                      <strong>{purchase.purchasedBy.name}</strong>
                      <small>{purchase.purchasedBy.email}</small>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result === undefined ? null : (
        <nav className="pagination" aria-label="Purchase history pages">
          <button
            type="button"
            disabled={page <= 1 || purchases.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <p>
            Page {result.meta.page} of {totalPages} - {result.meta.total} results
          </p>
          <button
            type="button"
            disabled={purchases.isFetching || result.meta.totalPages === 0 || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
