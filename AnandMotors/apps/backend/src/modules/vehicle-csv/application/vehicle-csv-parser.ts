import type { CreateVehicleData } from '../../vehicles/domain/vehicle-repository.js';
import { VehicleCsvError } from '../domain/vehicle-csv-errors.js';

const HEADERS = ['make', 'model', 'category', 'price', 'quantity'] as const;
const MAX_ROWS = 1_000;
const MAX_TEXT_LENGTH = 100;
const MAX_PRICE = 999_999_999_999.99;
const MAX_QUANTITY = 2_147_483_647;

export interface CsvRow extends CreateVehicleData {
  row: number;
}

export interface CsvRowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface CsvPreview {
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: CsvRow[];
  errors: CsvRowError[];
}

function recordsFrom(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new VehicleCsvError('CSV_INVALID_ROWS', 'The CSV contains an unterminated quote.');
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  while (records.at(-1)?.every((value) => value.trim() === '') === true) {
    records.pop();
  }
  return records;
}

function validateHeaders(fields: string[] | undefined): void {
  if (fields === undefined) {
    throw new VehicleCsvError('CSV_FILE_REQUIRED', 'The CSV file is empty.');
  }
  const normalized = fields.map((field) =>
    field
      .replace(/^\uFEFF/u, '')
      .trim()
      .toLowerCase(),
  );
  const duplicates = normalized.filter((field, index) => normalized.indexOf(field) !== index);
  if (
    normalized.length !== HEADERS.length ||
    duplicates.length > 0 ||
    HEADERS.some((header, index) => normalized[index] !== header)
  ) {
    throw new VehicleCsvError(
      'CSV_INVALID_HEADERS',
      `CSV headers must be exactly: ${HEADERS.join(',')}.`,
      { headers: normalized, duplicates: [...new Set(duplicates)] },
    );
  }
}

function textError(row: number, field: string, value: string): CsvRowError | undefined {
  if (value === '') {
    return { row, field, code: 'REQUIRED', message: `${field} is required.` };
  }
  if (value.length > MAX_TEXT_LENGTH) {
    return {
      row,
      field,
      code: 'TOO_LONG',
      message: `${field} must contain at most ${MAX_TEXT_LENGTH} characters.`,
    };
  }
  return undefined;
}

export function parseVehicleCsv(buffer: Buffer): CsvPreview {
  const records = recordsFrom(buffer.toString('utf8'));
  validateHeaders(records.shift());
  if (records.length > MAX_ROWS) {
    throw new VehicleCsvError(
      'CSV_ROW_LIMIT_EXCEEDED',
      `CSV files may contain at most ${MAX_ROWS} data rows.`,
      { maximumRows: MAX_ROWS },
    );
  }

  const rows: CsvRow[] = [];
  const errors: CsvRowError[] = [];
  let invalidRows = 0;
  records.forEach((fields, index) => {
    const row = index + 2;
    if (fields.length !== HEADERS.length) {
      errors.push({
        row,
        field: 'row',
        code: 'COLUMN_COUNT',
        message: `Row must contain exactly ${HEADERS.length} columns.`,
      });
      invalidRows += 1;
      return;
    }
    const [rawMake = '', rawModel = '', rawCategory = '', rawPrice = '', rawQuantity = ''] = fields;
    const make = rawMake.trim();
    const model = rawModel.trim();
    const category = rawCategory.trim();
    const price = rawPrice.trim();
    const quantityText = rawQuantity.trim();
    const rowErrors = [
      textError(row, 'make', make),
      textError(row, 'model', model),
      textError(row, 'category', category),
    ].filter((error): error is CsvRowError => error !== undefined);
    if (
      !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(price) ||
      Number(price) <= 0 ||
      Number(price) > MAX_PRICE
    ) {
      rowErrors.push({
        row,
        field: 'price',
        code: 'INVALID_PRICE',
        message: 'price must be a positive decimal with at most two decimal places.',
      });
    }
    if (!/^(?:0|[1-9]\d*)$/u.test(quantityText) || Number(quantityText) > MAX_QUANTITY) {
      rowErrors.push({
        row,
        field: 'quantity',
        code: 'INVALID_QUANTITY',
        message: 'quantity must be a supported non-negative integer.',
      });
    }
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      invalidRows += 1;
    } else {
      rows.push({ row, make, model, category, price, quantity: Number(quantityText) });
    }
  });

  return {
    headers: [...HEADERS],
    totalRows: records.length,
    validRows: rows.length,
    invalidRows,
    rows,
    errors,
  };
}
