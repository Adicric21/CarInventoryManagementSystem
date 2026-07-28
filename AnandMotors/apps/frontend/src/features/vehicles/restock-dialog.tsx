import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';

import { apiClient, ApiError, getErrorMessage } from '../../lib/api/client.js';
import type { Vehicle } from '../../lib/api/types.js';
import { Dialog } from './confirmation-dialog.js';
import { restockSchema, type RestockFormValues } from './vehicle-validation.js';

interface RestockDialogProps {
  open: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onRestocked: (vehicle: Vehicle) => void;
}

function safeRestockError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'VEHICLE_NOT_FOUND') {
    return 'Vehicle was not found. It may no longer be available.';
  }

  return getErrorMessage(error, 'Unable to restock the vehicle. Please try again.');
}

export function RestockDialog({ open, vehicle, onClose, onRestocked }: RestockDialogProps) {
  const quantityId = useId();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<RestockFormValues>({
    resolver: zodResolver(restockSchema),
    defaultValues: { quantity: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ quantity: '' });
    }
  }, [open, reset]);

  const submit = async ({ quantity }: RestockFormValues) => {
    try {
      const updatedVehicle = await apiClient.restockVehicle(vehicle.id, Number(quantity));
      onRestocked(updatedVehicle);
      onClose();
    } catch (error) {
      setError('root', { message: safeRestockError(error) });
    }
  };

  return (
    <Dialog open={open} title="Restock Vehicle" onClose={onClose} pending={isSubmitting}>
      <p>
        Add stock for {vehicle.make} {vehicle.model}.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(submit)(event);
        }}
      >
        <div className="form-field">
          <label htmlFor={quantityId}>Restock quantity</label>
          <input
            id={quantityId}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            aria-invalid={errors.quantity === undefined ? undefined : 'true'}
            aria-describedby={errors.quantity === undefined ? undefined : `${quantityId}-error`}
            {...register('quantity')}
          />
          {errors.quantity === undefined ? null : (
            <p id={`${quantityId}-error`} className="field-error">
              {errors.quantity.message}
            </p>
          )}
        </div>

        {errors.root?.message === undefined ? null : (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}

        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Restocking...' : 'Restock Vehicle'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
