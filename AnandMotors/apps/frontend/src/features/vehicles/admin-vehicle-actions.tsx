import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { apiClient, ApiError, getErrorMessage } from '../../lib/api/client.js';
import type { CreateVehicleInput, Vehicle } from '../../lib/api/types.js';
import { useAuth } from '../auth/auth-context.js';
import { ConfirmationDialog } from './confirmation-dialog.js';
import { RestockDialog } from './restock-dialog.js';
import { VehicleFormDialog } from './vehicle-form-dialog.js';

interface AddVehicleActionProps {
  onVehicleCreated: (vehicle: Vehicle) => void;
}

export function AddVehicleAction({ onVehicleCreated }: AddVehicleActionProps) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (role !== 'ADMIN') {
    return null;
  }

  const createVehicle = async (input: CreateVehicleInput) => {
    const vehicle = await apiClient.createVehicle(input);
    onVehicleCreated(vehicle);
    setOpen(false);
    setFeedback('Vehicle added successfully.');
  };

  return (
    <div className="catalogue-admin-actions">
      <button
        type="button"
        className="button button-primary"
        onClick={() => {
          setFeedback(null);
          setOpen(true);
        }}
      >
        Add Vehicle
      </button>
      {feedback === null ? null : (
        <p className="success-message" role="status">
          {feedback}
        </p>
      )}
      <VehicleFormDialog
        mode="create"
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        onSubmit={createVehicle}
      />
    </div>
  );
}

interface AdminVehicleActionsProps {
  vehicle: Vehicle;
  onVehicleUpdated: (vehicle: Vehicle) => void;
  onVehicleDeleted: (id: string) => void;
}

type OpenDialog = 'edit' | 'delete' | 'restock' | null;

function safeDeleteError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'VEHICLE_NOT_FOUND') {
    return 'Vehicle was not found. It may no longer be available.';
  }

  return getErrorMessage(error, 'Unable to delete the vehicle. Please try again.');
}

export function AdminVehicleActions({
  onVehicleDeleted,
  onVehicleUpdated,
  vehicle,
}: AdminVehicleActionsProps) {
  const { role } = useAuth();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (role !== 'ADMIN') {
    return null;
  }

  const closeDialog = () => {
    if (!deletePending) {
      setOpenDialog(null);
      setDeleteError(null);
    }
  };

  const updateVehicle = async (input: CreateVehicleInput) => {
    const updatedVehicle = await apiClient.updateVehicle(vehicle.id, input);
    onVehicleUpdated(updatedVehicle);
    setOpenDialog(null);
    setFeedback('Vehicle updated successfully.');
  };

  const restocked = (updatedVehicle: Vehicle) => {
    onVehicleUpdated(updatedVehicle);
    setFeedback('Vehicle restocked successfully.');
  };

  const deleteVehicle = async () => {
    if (deletePending) {
      return;
    }

    setDeletePending(true);
    setDeleteError(null);

    try {
      await apiClient.deleteVehicle(vehicle.id);
      setOpenDialog(null);
      setFeedback('Vehicle deleted successfully.');
      onVehicleDeleted(vehicle.id);
    } catch (error) {
      setDeleteError(safeDeleteError(error));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="admin-vehicle-actions">
      <div
        className="vehicle-action-row"
        aria-label={`Administrator actions for ${vehicle.make} ${vehicle.model}`}
      >
        <button
          type="button"
          className="button button-secondary"
          aria-label={`Edit ${vehicle.make} ${vehicle.model}`}
          onClick={() => {
            setFeedback(null);
            setOpenDialog('edit');
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="button button-secondary"
          aria-label={`Restock ${vehicle.make} ${vehicle.model}`}
          onClick={() => {
            setFeedback(null);
            setOpenDialog('restock');
          }}
        >
          Restock
        </button>
        <button
          type="button"
          className="button button-danger"
          aria-label={`Delete ${vehicle.make} ${vehicle.model}`}
          onClick={() => {
            setFeedback(null);
            setDeleteError(null);
            setOpenDialog('delete');
          }}
        >
          Delete
        </button>
      </div>

      {feedback === null ? null : (
        <p className="success-message" role="status">
          {feedback}
        </p>
      )}

      <VehicleFormDialog
        mode="edit"
        open={openDialog === 'edit'}
        vehicle={vehicle}
        onClose={closeDialog}
        onSubmit={updateVehicle}
      />
      <RestockDialog
        open={openDialog === 'restock'}
        vehicle={vehicle}
        onClose={closeDialog}
        onRestocked={restocked}
      />
      <ConfirmationDialog
        open={openDialog === 'delete'}
        title="Delete Vehicle"
        message={
          <>
            Delete {vehicle.make} {vehicle.model}? This action cannot be undone.
          </>
        }
        confirmLabel="Delete Vehicle"
        pendingLabel="Deleting vehicle..."
        pending={deletePending}
        error={deleteError}
        onCancel={closeDialog}
        onConfirm={() => {
          void deleteVehicle();
        }}
      />
    </div>
  );
}

export function NewVehiclePage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  if (role !== 'ADMIN') {
    return <Navigate to="/vehicles" replace />;
  }

  const createVehicle = async (input: CreateVehicleInput) => {
    await apiClient.createVehicle(input);
    void navigate('/vehicles', { replace: true });
  };

  return (
    <main className="page-shell">
      <VehicleFormDialog
        mode="create"
        open
        onClose={() => {
          void navigate('/vehicles');
        }}
        onSubmit={createVehicle}
      />
    </main>
  );
}
