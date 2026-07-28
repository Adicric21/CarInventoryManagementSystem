import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { apiClient } from '../../lib/api/client.js';
import type { Vehicle, VehiclePage, VehicleSearchQuery } from '../../lib/api/types.js';
import { useAuth } from '../auth/auth-context.js';
import { AddVehicleAction } from './admin-vehicle-actions.js';
import { defaultVehicleFilters, type VehicleFilterValues } from './vehicle-filter-types.js';
import { VehicleFilters } from './vehicle-filters.js';
import { VehicleCard } from './vehicle-card.js';

const VEHICLE_QUERY_KEY = ['vehicles'] as const;
const PAGE_SIZE = 10;

function trimmed(value: string): string | undefined {
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

function toSearchQuery(filters: VehicleFilterValues, page: number): VehicleSearchQuery {
  const make = trimmed(filters.make);
  const model = trimmed(filters.model);
  const category = trimmed(filters.category);
  const minPrice = trimmed(filters.minPrice);
  const maxPrice = trimmed(filters.maxPrice);

  return {
    page,
    limit: PAGE_SIZE,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    ...(make === undefined ? {} : { make }),
    ...(model === undefined ? {} : { model }),
    ...(category === undefined ? {} : { category }),
    ...(minPrice === undefined ? {} : { minPrice }),
    ...(maxPrice === undefined ? {} : { maxPrice }),
    ...(filters.inStock ? { inStock: true } : {}),
  };
}

function hasActiveFilters(filters: VehicleFilterValues): boolean {
  return (
    trimmed(filters.make) !== undefined ||
    trimmed(filters.model) !== undefined ||
    trimmed(filters.category) !== undefined ||
    trimmed(filters.minPrice) !== undefined ||
    trimmed(filters.maxPrice) !== undefined ||
    filters.inStock
  );
}

function matchesText(value: string, filter: string | undefined): boolean {
  return filter === undefined || value.toLocaleLowerCase().includes(filter.toLocaleLowerCase());
}

function matchesSearchQuery(vehicle: Vehicle, query: VehicleSearchQuery): boolean {
  const minimumPrice = query.minPrice === undefined ? undefined : Number(query.minPrice);
  const maximumPrice = query.maxPrice === undefined ? undefined : Number(query.maxPrice);

  return (
    matchesText(vehicle.make, query.make) &&
    matchesText(vehicle.model, query.model) &&
    matchesText(vehicle.category, query.category) &&
    (minimumPrice === undefined || vehicle.price >= minimumPrice) &&
    (maximumPrice === undefined || vehicle.price <= maximumPrice) &&
    (query.inStock !== true || vehicle.quantity > 0)
  );
}

function compareVehicles(left: Vehicle, right: Vehicle, query: VehicleSearchQuery): number {
  const sortBy = query.sortBy ?? 'createdAt';
  const leftValue = left[sortBy];
  const rightValue = right[sortBy];
  const comparison =
    typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' });
  const directedComparison = query.sortOrder === 'asc' ? comparison : -comparison;

  return directedComparison === 0 ? left.id.localeCompare(right.id) : directedComparison;
}

function replaceVehicleInPage(
  page: VehiclePage,
  vehicle: Vehicle,
  query: VehicleSearchQuery,
): VehiclePage {
  if (!page.data.some((existing) => existing.id === vehicle.id)) {
    return page;
  }

  if (!matchesSearchQuery(vehicle, query)) {
    return removeVehicleFromPage(page, vehicle.id);
  }

  return {
    ...page,
    data: page.data
      .map((existing) => (existing.id === vehicle.id ? vehicle : existing))
      .sort((left, right) => compareVehicles(left, right, query)),
  };
}

function addVehicleToPage(
  page: VehiclePage,
  vehicle: Vehicle,
  query: VehicleSearchQuery,
): VehiclePage {
  if (page.data.some((existing) => existing.id === vehicle.id)) {
    return replaceVehicleInPage(page, vehicle, query);
  }

  if (query.page !== 1 || !matchesSearchQuery(vehicle, query)) {
    return page;
  }

  const total = page.meta.total + 1;
  return {
    data: [...page.data, vehicle]
      .sort((left, right) => compareVehicles(left, right, query))
      .slice(0, page.meta.limit),
    meta: {
      ...page.meta,
      total,
      totalPages: Math.ceil(total / page.meta.limit),
    },
  };
}

function removeVehicleFromPage(page: VehiclePage, vehicleId: string): VehiclePage {
  const data = page.data.filter((vehicle) => vehicle.id !== vehicleId);

  if (data.length === page.data.length) {
    return page;
  }

  const total = Math.max(0, page.meta.total - 1);
  return {
    data,
    meta: {
      ...page.meta,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / page.meta.limit),
    },
  };
}

export function CataloguePage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(defaultVehicleFilters);
  const [pageNumber, setPageNumber] = useState(1);
  const [catalogueFeedback, setCatalogueFeedback] = useState<string>();
  const searchQuery = useMemo(() => toSearchQuery(filters, pageNumber), [filters, pageNumber]);
  const currentVehicleQueryKey = [...VEHICLE_QUERY_KEY, searchQuery] as const;
  const vehicles = useQuery({
    queryKey: currentVehicleQueryKey,
    queryFn: () => apiClient.searchVehicles(searchQuery),
    placeholderData: keepPreviousData,
    retry: false,
  });

  function updateCurrentPage(update: (page: VehiclePage) => VehiclePage): void {
    queryClient.setQueryData<VehiclePage>(currentVehicleQueryKey, (current) =>
      current === undefined ? current : update(current),
    );
  }

  function refreshVehiclePages(): void {
    void queryClient.invalidateQueries({ queryKey: VEHICLE_QUERY_KEY });
  }

  function replaceVehicle(vehicle: Vehicle): void {
    updateCurrentPage((page) => replaceVehicleInPage(page, vehicle, searchQuery));
    refreshVehiclePages();
  }

  function replacePurchasedVehicle(vehicle: Vehicle): void {
    replaceVehicle(vehicle);
    setCatalogueFeedback('Vehicle purchased successfully.');
  }

  function replaceOrAddVehicle(vehicle: Vehicle): void {
    updateCurrentPage((page) => addVehicleToPage(page, vehicle, searchQuery));
    refreshVehiclePages();
  }

  function removeVehicle(vehicleId: string): void {
    updateCurrentPage((page) => removeVehicleFromPage(page, vehicleId));
    refreshVehiclePages();
    setCatalogueFeedback('Vehicle deleted successfully.');
  }

  function applyFilters(nextFilters: VehicleFilterValues): void {
    setCatalogueFeedback(undefined);
    setPageNumber(1);
    setFilters(nextFilters);
  }

  function clearFilters(): void {
    setCatalogueFeedback(undefined);
    setPageNumber(1);
    setFilters(defaultVehicleFilters);
  }

  const isAdministrator = role === 'ADMIN';
  const result = vehicles.data;
  const totalPages = Math.max(1, result?.meta.totalPages ?? 1);
  const displayedPage = result?.meta.page ?? pageNumber;
  const isInitialLoading = vehicles.isPending && result === undefined;
  const isRefreshing = vehicles.isFetching && !isInitialLoading;

  return (
    <main className="catalogue-page">
      <header className="catalogue-page__header">
        <div>
          <p className="eyebrow">Curated dealership inventory</p>
          <h1 tabIndex={-1} data-dialog-focus-fallback>
            Vehicle catalogue
          </h1>
          <p>Explore available vehicles, compare stock, and purchase with confidence.</p>
        </div>
        {isAdministrator ? <AddVehicleAction onVehicleCreated={replaceOrAddVehicle} /> : null}
      </header>

      <VehicleFilters
        value={filters}
        isRefreshing={isRefreshing}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {catalogueFeedback === undefined ? null : (
        <p className="catalogue-feedback" role="status" aria-live="polite">
          {catalogueFeedback}
        </p>
      )}

      {isInitialLoading ? (
        <section className="catalogue-loading" aria-live="polite">
          <p className="sr-only" role="status">
            Loading vehicles...
          </p>
          <div className="vehicle-grid" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <article className="vehicle-card vehicle-card--skeleton" key={item}>
                <span className="skeleton-line skeleton-line--short" />
                <span className="skeleton-line skeleton-line--title" />
                <span className="skeleton-line skeleton-line--price" />
                <span className="skeleton-block" />
                <span className="skeleton-block skeleton-block--button" />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {vehicles.isError && result === undefined ? (
        <section className="catalogue-state" role="alert">
          <h2>Unable to load vehicles</h2>
          <p>We could not load the inventory. Please try again.</p>
          <button type="button" onClick={() => void vehicles.refetch()}>
            Retry
          </button>
        </section>
      ) : null}

      {vehicles.isError && result !== undefined ? (
        <div className="catalogue-inline-error" role="alert">
          <p>Unable to refresh vehicles. Your previous results are still shown.</p>
          <button type="button" onClick={() => void vehicles.refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {result !== undefined && result.data.length === 0 ? (
        <section className="catalogue-state" aria-live="polite">
          <h2>
            {pageNumber > 1
              ? 'No vehicles found on this page'
              : hasActiveFilters(filters)
                ? 'No vehicles match your filters'
                : 'No vehicles available'}
          </h2>
          <p>
            {pageNumber > 1
              ? 'Return to the previous page to continue browsing.'
              : 'Try adjusting your filters or check again later.'}
          </p>
        </section>
      ) : null}

      {result !== undefined && result.data.length > 0 ? (
        <section className="vehicle-grid" aria-label="Available vehicles">
          {result.data.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              isAdministrator={isAdministrator}
              onVehiclePurchased={replacePurchasedVehicle}
              onVehicleUpdated={replaceVehicle}
              onVehicleDeleted={removeVehicle}
            />
          ))}
        </section>
      ) : null}

      {result === undefined ? null : (
        <nav className="pagination" aria-label="Vehicle catalogue pages">
          <button
            type="button"
            aria-label="Previous page"
            disabled={pageNumber <= 1 || vehicles.isFetching}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <p aria-live="polite">
            Page {displayedPage} of {totalPages} - {result.meta.total} results
          </p>
          <button
            type="button"
            aria-label="Next page"
            disabled={
              vehicles.isFetching || result.meta.totalPages === 0 || pageNumber >= totalPages
            }
            onClick={() => setPageNumber((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
