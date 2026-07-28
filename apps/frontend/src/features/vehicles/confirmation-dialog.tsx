import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  pending?: boolean;
}

export function Dialog({ children, onClose, open, pending = false, title }: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstControl = dialogRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    firstControl?.focus();

    return () => {
      if (previouslyFocused?.isConnected === true) {
        previouslyFocused.focus();
      } else {
        document.querySelector<HTMLElement>('[data-dialog-focus-fallback]')?.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        onClose();
      }

      if (event.key !== 'Tab') {
        return;
      }

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((control) => !control.hasAttribute('disabled'));

      if (controls.length === 0) {
        event.preventDefault();
        return;
      }

      const firstControl = controls[0];
      const lastControl = controls.at(-1);
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstControl || !dialogRef.current?.contains(activeElement))
      ) {
        event.preventDefault();
        lastControl?.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastControl || !dialogRef.current?.contains(activeElement))
      ) {
        event.preventDefault();
        firstControl?.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeys);

    return () => {
      window.removeEventListener('keydown', handleDialogKeys);
    };
  }, [onClose, open, pending]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="dialog-backdrop">
      <section
        ref={dialogRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>,
    document.body,
  );
}

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  confirmLabel,
  error,
  message,
  onCancel,
  onConfirm,
  open,
  pending,
  pendingLabel,
  title,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={open} title={title} onClose={onCancel} pending={pending}>
      <p>{message}</p>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button-danger"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
