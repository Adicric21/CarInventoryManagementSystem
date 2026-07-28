import { useState, type FormEvent } from 'react';

import { defaultVehicleFilters, type VehicleFilterValues } from './vehicle-filter-types.js';

interface VehicleFiltersProps {
  value: VehicleFilterValues;
  isRefreshing: boolean;
  onApply: (filters: VehicleFilterValues) => void;
  onClear: () => void;
}

function hasInvalidPriceRange({ minPrice, maxPrice }: VehicleFilterValues): boolean {
  if (minPrice === '' || maxPrice === '') {
    return false;
  }

  return Number(minPrice) > Number(maxPrice);
}

export function VehicleFilters({ value, isRefreshing, onApply, onClear }: VehicleFiltersProps) {
  const [draft, setDraft] = useState(value);
  const [rangeError, setRangeError] = useState<string>();

  function update<Field extends keyof VehicleFilterValues>(
    field: Field,
    nextValue: VehicleFilterValues[Field],
  ): void {
    setDraft((current) => ({ ...current, [field]: nextValue }));
    setRangeError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (hasInvalidPriceRange(draft)) {
      setRangeError('Minimum price must not exceed maximum price.');
      return;
    }

    setRangeError(undefined);
    onApply(draft);
  }

  function clear(): void {
    setDraft(defaultVehicleFilters);
    setRangeError(undefined);
    onClear();
  }

  return (
    <form className="vehicle-filters" aria-label="Search and filter vehicles" onSubmit={submit}>
      <div className="vehicle-filters__fields">
        <label>
          Make
          <input
            name="make"
            value={draft.make}
            onChange={(event) => update('make', event.target.value)}
            autoComplete="off"
          />
        </label>

        <label>
          Model
          <input
            name="model"
            value={draft.model}
            onChange={(event) => update('model', event.target.value)}
            autoComplete="off"
          />
        </label>

        <label>
          Category
          <input
            name="category"
            value={draft.category}
            onChange={(event) => update('category', event.target.value)}
            autoComplete="off"
          />
        </label>

        <label>
          Minimum price
          <input
            name="minPrice"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.minPrice}
            aria-invalid={rangeError === undefined ? undefined : true}
            aria-describedby={rangeError === undefined ? undefined : 'vehicle-price-range-error'}
            onChange={(event) => update('minPrice', event.target.value)}
          />
        </label>

        <label>
          Maximum price
          <input
            name="maxPrice"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.maxPrice}
            aria-invalid={rangeError === undefined ? undefined : true}
            aria-describedby={rangeError === undefined ? undefined : 'vehicle-price-range-error'}
            onChange={(event) => update('maxPrice', event.target.value)}
          />
        </label>

        <label className="vehicle-filters__checkbox">
          <input
            type="checkbox"
            checked={draft.inStock}
            onChange={(event) => update('inStock', event.target.checked)}
          />
          In stock only
        </label>

        <label>
          Sort by
          <select
            name="sortBy"
            value={draft.sortBy}
            onChange={(event) =>
              update('sortBy', event.target.value as VehicleFilterValues['sortBy'])
            }
          >
            <option value="createdAt">Newest</option>
            <option value="make">Make</option>
            <option value="model">Model</option>
            <option value="category">Category</option>
            <option value="price">Price</option>
            <option value="quantity">Quantity</option>
          </select>
        </label>

        <label>
          Sort direction
          <select
            name="sortOrder"
            value={draft.sortOrder}
            onChange={(event) =>
              update('sortOrder', event.target.value as VehicleFilterValues['sortOrder'])
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      {rangeError === undefined ? null : (
        <p id="vehicle-price-range-error" className="field-error" role="alert">
          {rangeError}
        </p>
      )}

      <div className="vehicle-filters__actions">
        <button type="submit">Apply filters</button>
        <button type="button" onClick={clear}>
          Clear filters
        </button>
        {isRefreshing ? (
          <span role="status" aria-live="polite">
            Updating vehicles...
          </span>
        ) : null}
      </div>
    </form>
  );
}
