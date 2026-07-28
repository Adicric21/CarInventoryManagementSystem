import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient, getErrorMessage } from '../../lib/api/client.js';
import type { VehicleCsvPreview } from '../../lib/api/types.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function VehicleCsvPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [inputKey, setInputKey] = useState(0);
  const [preview, setPreview] = useState<VehicleCsvPreview>();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState<'preview' | 'import' | 'export'>();

  function selectFile(selected: File | undefined): void {
    setPreview(undefined);
    setSuccess('');
    if (selected === undefined) {
      setFile(undefined);
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setFile(undefined);
      setError('Select a file with a .csv extension.');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(undefined);
      setError('CSV files must not exceed 2 MB.');
      return;
    }
    setFile(selected);
    setError('');
  }

  async function previewFile(): Promise<void> {
    if (file === undefined || pending !== undefined) {
      return;
    }
    setPending('preview');
    setError('');
    try {
      setPreview(await apiClient.previewVehicleCsv(file));
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to preview the CSV file.'));
    } finally {
      setPending(undefined);
    }
  }

  async function importFile(): Promise<void> {
    if (file === undefined || preview?.invalidRows !== 0 || pending !== undefined) {
      return;
    }
    setPending('import');
    setError('');
    try {
      const result = await apiClient.importVehicleCsv(file);
      setSuccess(`Imported ${result.imported} ${result.imported === 1 ? 'vehicle' : 'vehicles'}.`);
      setFile(undefined);
      setPreview(undefined);
      setInputKey((current) => current + 1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['low-stock-vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-activities'] }),
      ]);
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to import the CSV file.'));
    } finally {
      setPending(undefined);
    }
  }

  async function exportCsv(): Promise<void> {
    if (pending !== undefined) {
      return;
    }
    setPending('export');
    setError('');
    try {
      const blob = await apiClient.exportVehicleCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to export vehicles.'));
    } finally {
      setPending(undefined);
    }
  }

  function clear(): void {
    setFile(undefined);
    setPreview(undefined);
    setError('');
    setSuccess('');
    setInputKey((current) => current + 1);
  }

  return (
    <main className="activity-page csv-page">
      <header className="activity-page__header">
        <p className="eyebrow">Bulk inventory</p>
        <h1>Import and export vehicles</h1>
        <p>Preview validated CSV data before importing an all-or-nothing inventory batch.</p>
      </header>

      {error === '' ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success === '' ? null : (
        <p className="form-success" role="status">
          {success}
        </p>
      )}

      <section className="csv-panel">
        <h2>Export inventory</h2>
        <p>Download current inventory in deterministic CSV order.</p>
        <button type="button" disabled={pending !== undefined} onClick={() => void exportCsv()}>
          {pending === 'export' ? 'Preparing export...' : 'Download vehicles CSV'}
        </button>
      </section>

      <section className="csv-panel">
        <h2>Import inventory</h2>
        <p>
          Required headers: make, model, category, price, quantity. Maximum 1,000 rows and 2 MB.
        </p>
        <label>
          CSV file
          <input
            key={inputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
        {file === undefined ? null : (
          <p>
            Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
          </p>
        )}
        <div className="csv-actions">
          <button
            type="button"
            disabled={file === undefined || pending !== undefined}
            onClick={() => void previewFile()}
          >
            {pending === 'preview' ? 'Previewing...' : 'Preview CSV'}
          </button>
          <button type="button" disabled={pending !== undefined} onClick={clear}>
            Clear
          </button>
        </div>
      </section>

      {preview === undefined ? null : (
        <section className="csv-panel">
          <h2>Preview</h2>
          <div className="csv-summary">
            <strong>{preview.totalRows} total rows</strong>
            <strong>
              {preview.validRows} valid {preview.validRows === 1 ? 'row' : 'rows'}
            </strong>
            <strong>{preview.invalidRows} invalid rows</strong>
          </div>
          {preview.errors.length === 0 ? null : (
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((rowError, index) => (
                    <tr key={`${rowError.row}-${rowError.field}-${index}`}>
                      <td>{rowError.row}</td>
                      <td>{rowError.field}</td>
                      <td>{rowError.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            disabled={preview.invalidRows > 0 || pending !== undefined}
            onClick={() => void importFile()}
          >
            {pending === 'import' ? 'Importing...' : 'Confirm import'}
          </button>
        </section>
      )}
    </main>
  );
}
