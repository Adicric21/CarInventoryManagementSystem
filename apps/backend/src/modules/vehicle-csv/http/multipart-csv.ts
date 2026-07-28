import type { Request } from 'express';

import { VehicleCsvError } from '../domain/vehicle-csv-errors.js';

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_CSV_BYTES + 64 * 1024;

function boundaryFrom(contentType: string | undefined): string {
  const match = /multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/iu.exec(contentType ?? '');
  const boundary = match?.[1] ?? match?.[2]?.trim();
  if (boundary === undefined || boundary === '') {
    throw new VehicleCsvError('CSV_FILE_REQUIRED', 'A multipart CSV file is required.');
  }
  return boundary;
}

function readBody(request: Request): Promise<Buffer> {
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (declaredLength > MAX_MULTIPART_BYTES) {
    return Promise.reject(
      new VehicleCsvError('CSV_FILE_TOO_LARGE', 'CSV files must not exceed 2 MB.'),
    );
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_MULTIPART_BYTES) {
        reject(new VehicleCsvError('CSV_FILE_TOO_LARGE', 'CSV files must not exceed 2 MB.'));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('aborted', () =>
      reject(new VehicleCsvError('CSV_FILE_REQUIRED', 'The CSV upload was interrupted.')),
    );
    request.on('error', () =>
      reject(new VehicleCsvError('CSV_FILE_REQUIRED', 'The CSV upload could not be read.')),
    );
  });
}

export async function readCsvUpload(request: Request): Promise<Buffer> {
  const boundary = boundaryFrom(request.headers['content-type']);
  const body = await readBody(request);
  const encoded = body.toString('latin1');
  const parts = encoded.split(`--${boundary}`);
  const fileParts = parts.filter((part) =>
    /Content-Disposition:[^\r\n]*\bname="file"/iu.test(part),
  );
  const part = fileParts[0];
  if (part === undefined || fileParts.length !== 1) {
    throw new VehicleCsvError('CSV_FILE_REQUIRED', 'Exactly one CSV file is required.');
  }
  const headerEnd = part.indexOf('\r\n\r\n');
  if (headerEnd < 0 || !/filename="[^"]+\.csv"/iu.test(part.slice(0, headerEnd))) {
    throw new VehicleCsvError('CSV_FILE_REQUIRED', 'The file field must contain a .csv file.');
  }
  const content = part.slice(headerEnd + 4).replace(/\r\n$/u, '');
  const buffer = Buffer.from(content, 'latin1');
  if (buffer.length === 0) {
    throw new VehicleCsvError('CSV_FILE_REQUIRED', 'The CSV file is empty.');
  }
  if (buffer.length > MAX_CSV_BYTES) {
    throw new VehicleCsvError('CSV_FILE_TOO_LARGE', 'CSV files must not exceed 2 MB.');
  }
  return buffer;
}
