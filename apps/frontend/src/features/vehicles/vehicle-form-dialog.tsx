import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, type ReactNode } from 'react';
import { useForm, type FieldError } from 'react-hook-form';

import type { CreateVehicleInput, Vehicle } from '../../lib/api/types.js';
import { ApiError, getErrorMessage } from '../../lib/api/client.js';
import { Dialog } from './confirmation-dialog.js';
import { vehicleFormSchema, type VehicleFormValues } from './vehicle-validation.js';

const EMPTY_FORM: VehicleFormValues = {
  make: '',
  model: '',
  category: '',
  price: '',
  quantity: '',
};

type VehicleFormMode = 'create' | 'edit';

interface VehicleFormDialogProps {
  open: boolean;
  mode: VehicleFormMode;
  vehicle?: Vehicle;
  onClose: () => void;
  onSubmit: (input: CreateVehicleInput) => Promise<void>;
}

function formValues(vehicle: Vehicle | undefined): VehicleFormValues {
  if (vehicle === undefined) {
    return EMPTY_FORM;
  }

  return {
    make: vehicle.make,
    model: vehicle.model,
    category: vehicle.category,
    price: String(vehicle.price),
    quantity: String(vehicle.quantity),
  };
}

function toVehicleInput(values: VehicleFormValues): CreateVehicleInput {
  return {
    make: values.make.trim(),
    model: values.model.trim(),
    category: values.category.trim(),
    price: Number(values.price),
    quantity: Number(values.quantity),
  };
}

function safeSubmissionError(error: unknown, mode: VehicleFormMode): string {
  if (error instanceof ApiError && error.code === 'VEHICLE_NOT_FOUND') {
    return 'Vehicle was not found. It may no longer be available.';
  }

  return getErrorMessage(
    error,
    mode === 'create'
      ? 'Unable to add the vehicle. Please try again.'
      : 'Unable to update the vehicle. Please try again.',
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  error: FieldError | undefined;
  children: ReactNode;
}

function FormField({ children, error, id, label }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error === undefined ? null : (
        <p id={errorId} className="field-error">
          {error.message}
        </p>
      )}
    </div>
  );
}

export function VehicleFormDialog({
  mode,
  onClose,
  onSubmit,
  open,
  vehicle,
}: VehicleFormDialogProps) {
  const formId = useId();
  const {
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: formValues(vehicle),
  });

  useEffect(() => {
    if (open) {
      reset(formValues(vehicle));
    }
  }, [open, reset, vehicle]);

  const submit = async (values: VehicleFormValues) => {
    try {
      await onSubmit(toVehicleInput(values));
    } catch (error) {
      setError('root', { message: safeSubmissionError(error, mode) });
    }
  };

  const isCreate = mode === 'create';
  const title = isCreate ? 'Add Vehicle' : 'Edit Vehicle';

  return (
    <Dialog open={open} title={title} onClose={onClose} pending={isSubmitting}>
      <form
        className="vehicle-form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(submit)(event);
        }}
      >
        <FormField id={`${formId}-make`} label="Make" error={errors.make}>
          <input
            id={`${formId}-make`}
            autoComplete="off"
            aria-invalid={errors.make === undefined ? undefined : 'true'}
            aria-describedby={errors.make === undefined ? undefined : `${formId}-make-error`}
            {...register('make')}
          />
        </FormField>

        <FormField id={`${formId}-model`} label="Model" error={errors.model}>
          <input
            id={`${formId}-model`}
            autoComplete="off"
            aria-invalid={errors.model === undefined ? undefined : 'true'}
            aria-describedby={errors.model === undefined ? undefined : `${formId}-model-error`}
            {...register('model')}
          />
        </FormField>

        <FormField id={`${formId}-category`} label="Category" error={errors.category}>
          <input
            id={`${formId}-category`}
            autoComplete="off"
            aria-invalid={errors.category === undefined ? undefined : 'true'}
            aria-describedby={
              errors.category === undefined ? undefined : `${formId}-category-error`
            }
            {...register('category')}
          />
        </FormField>

        <FormField id={`${formId}-price`} label="Price" error={errors.price}>
          <input
            id={`${formId}-price`}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            aria-invalid={errors.price === undefined ? undefined : 'true'}
            aria-describedby={errors.price === undefined ? undefined : `${formId}-price-error`}
            {...register('price')}
          />
        </FormField>

        <FormField id={`${formId}-quantity`} label="Quantity" error={errors.quantity}>
          <input
            id={`${formId}-quantity`}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            aria-invalid={errors.quantity === undefined ? undefined : 'true'}
            aria-describedby={
              errors.quantity === undefined ? undefined : `${formId}-quantity-error`
            }
            {...register('quantity')}
          />
        </FormField>

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
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || (!isCreate && !isDirty)}
          >
            {isSubmitting
              ? isCreate
                ? 'Adding vehicle...'
                : 'Saving changes...'
              : isCreate
                ? 'Add Vehicle'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
