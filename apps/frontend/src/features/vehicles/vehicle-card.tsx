import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient, getErrorMessage } from '../../lib/api/client.js';
import type { Vehicle } from '../../lib/api/types.js';
import { AdminVehicleActions } from './admin-vehicle-actions.js';
import { formatInr } from './vehicle-formatting.js';

interface VehicleCardProps {
  vehicle: Vehicle;
  isAdministrator: boolean;
  onVehiclePurchased: (vehicle: Vehicle) => void;
  onVehicleUpdated: (vehicle: Vehicle) => void;
  onVehicleDeleted: (vehicleId: string) => void;
}

function purchaseFailureMessage(error: unknown): string {
  return getErrorMessage(error, 'Unable to purchase this vehicle. Please try again.');
}

export function VehicleCard({
  vehicle,
  isAdministrator,
  onVehiclePurchased,
  onVehicleUpdated,
  onVehicleDeleted,
}: VehicleCardProps) {
  const [feedback, setFeedback] = useState<string>();
  const purchase = useMutation({
    mutationFn: () => apiClient.purchaseVehicle(vehicle.id, 1),
    onMutate: () => {
      setFeedback(undefined);
    },
    onSuccess: (updatedVehicle) => {
      onVehiclePurchased(updatedVehicle);
    },
    onError: (error) => {
      setFeedback(purchaseFailureMessage(error));
    },
  });
  const isOutOfStock = vehicle.stockStatus === 'OUT_OF_STOCK';
  const stockLabel =
    vehicle.stockStatus === 'OUT_OF_STOCK'
      ? 'Out of stock'
      : vehicle.stockStatus === 'LOW_STOCK'
        ? 'Low stock'
        : 'In stock';

  return (
    <article className="vehicle-card" aria-labelledby={`vehicle-${vehicle.id}-title`}>
      <div className="vehicle-card__heading">
        <div>
          <p className="vehicle-card__category">{vehicle.category}</p>
          <h2 id={`vehicle-${vehicle.id}-title`}>
            <span>{vehicle.make}</span> <span>{vehicle.model}</span>
          </h2>
        </div>
        <p className="vehicle-card__price">{formatInr(vehicle.price)}</p>
      </div>

      <div className="vehicle-card__stock">
        <p>Quantity: {vehicle.quantity}</p>
        <p>{vehicle.quantity} units available</p>
        <p
          className={`stock-status${
            vehicle.stockStatus === 'OUT_OF_STOCK'
              ? ' stock-status--out'
              : vehicle.stockStatus === 'LOW_STOCK'
                ? ' stock-status--low'
                : ''
          }`}
        >
          {stockLabel}
        </p>
      </div>

      <div className="vehicle-card__actions">
        <button
          type="button"
          disabled={isOutOfStock || purchase.isPending}
          onClick={() => purchase.mutate()}
        >
          {purchase.isPending ? 'Purchasing...' : 'Purchase'}
        </button>

        {isAdministrator ? (
          <AdminVehicleActions
            vehicle={vehicle}
            onVehicleUpdated={onVehicleUpdated}
            onVehicleDeleted={onVehicleDeleted}
          />
        ) : null}
      </div>

      {feedback === undefined ? null : (
        <p
          className="vehicle-card__feedback vehicle-card__feedback--error"
          role="alert"
          aria-live="assertive"
        >
          {feedback}
        </p>
      )}
    </article>
  );
}
