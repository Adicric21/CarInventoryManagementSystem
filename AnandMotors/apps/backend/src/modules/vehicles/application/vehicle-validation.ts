import { z } from 'zod';

import { vehicleValidationError } from '../domain/vehicle-errors.js';
import { VEHICLE_SORT_FIELDS } from '../domain/vehicle-types.js';

const MAX_TEXT_LENGTH = 100;
const MAX_VEHICLE_PRICE = 999_999_999_999.99;
const MAX_VEHICLE_QUANTITY = 2_147_483_647;

const vehicleText = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(MAX_TEXT_LENGTH, `This field must contain at most ${MAX_TEXT_LENGTH} characters.`);
const price = z
  .number()
  .finite()
  .positive('Price must be greater than zero.')
  .max(MAX_VEHICLE_PRICE, 'Price exceeds the supported range.')
  .refine((value) => /^\d+(?:\.\d{1,2})?$/u.test(String(value)), {
    message: 'Price must have at most two decimal places.',
  });
const quantity = z
  .number()
  .int('Quantity must be an integer.')
  .nonnegative('Quantity must be zero or greater.')
  .max(MAX_VEHICLE_QUANTITY, 'Quantity exceeds the supported range.');

const createVehicleSchema = z
  .object({
    make: vehicleText,
    model: vehicleText,
    category: vehicleText,
    price,
    quantity,
  })
  .strict();

const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required.');

const inventoryQuantitySchema = z
  .object({
    quantity: z
      .number()
      .int('Quantity must be an integer.')
      .positive('Quantity must be greater than zero.')
      .max(MAX_VEHICLE_QUANTITY, 'Quantity exceeds the supported range.'),
  })
  .strict();

const vehicleIdSchema = z.string().uuid('Vehicle id must be a valid UUID.');

const integerQuery = (maximum?: number) => {
  const numberSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
  const stringSchema = z
    .string()
    .regex(/^[1-9]\d*$/u)
    .transform((value) => Number(value))
    .pipe(numberSchema);
  const schema = z.union([numberSchema, stringSchema]);

  return maximum === undefined ? schema : schema.pipe(z.number().max(maximum));
};

const paginationShape = {
  page: integerQuery().default(1),
  limit: integerQuery(100).default(10),
};

function hasSafePaginationOffset({ page, limit }: { page: number; limit: number }): boolean {
  return Number.isSafeInteger((page - 1) * limit);
}

const safePaginationIssue = {
  message: 'The requested page is outside the supported range.',
  path: ['page'],
};

const listVehiclesSchema = z
  .object({
    ...paginationShape,
  })
  .strict()
  .refine(hasSafePaginationOffset, safePaginationIssue);

const decimalString = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/u, 'Price must be a non-negative decimal.');

const searchVehiclesSchema = z
  .object({
    make: vehicleText.optional(),
    model: vehicleText.optional(),
    category: vehicleText.optional(),
    minPrice: decimalString.optional(),
    maxPrice: decimalString.optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    ...paginationShape,
    sortBy: z.enum(VEHICLE_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined ||
      maxPrice === undefined ||
      compareNonNegativeDecimals(minPrice, maxPrice) <= 0,
    {
      message: 'Minimum price must not exceed maximum price.',
      path: ['minPrice'],
    },
  )
  .refine(hasSafePaginationOffset, safePaginationIssue);

const lowStockVehiclesSchema = z
  .object({
    ...paginationShape,
    sortBy: z.enum(['quantity', 'make', 'model', 'category']).default('quantity'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict()
  .refine(hasSafePaginationOffset, safePaginationIssue);

function compareNonNegativeDecimals(left: string, right: string): number {
  const [leftInteger = '', leftFraction = ''] = left.split('.');
  const [rightInteger = '', rightFraction = ''] = right.split('.');
  const normalizedLeftInteger = leftInteger.replace(/^0+(?=\d)/u, '');
  const normalizedRightInteger = rightInteger.replace(/^0+(?=\d)/u, '');

  if (normalizedLeftInteger.length !== normalizedRightInteger.length) {
    return normalizedLeftInteger.length - normalizedRightInteger.length;
  }

  const integerComparison = normalizedLeftInteger.localeCompare(normalizedRightInteger);

  if (integerComparison !== 0) {
    return integerComparison;
  }

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction
    .padEnd(fractionLength, '0')
    .localeCompare(rightFraction.padEnd(fractionLength, '0'));
}

function validationDetails(error: z.ZodError): Readonly<Record<string, unknown>> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    const key = typeof field === 'string' ? field : 'request';
    const messages = fields[key] ?? [];
    messages.push(issue.message);
    fields[key] = messages;
  }

  return { fields };
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw vehicleValidationError(validationDetails(result.error));
  }

  return result.data;
}

export function parseCreateVehicleInput(input: unknown) {
  return parse(createVehicleSchema, input);
}

export function parseUpdateVehicleInput(input: unknown) {
  return parse(updateVehicleSchema, input);
}

export function parseVehicleId(input: unknown): string {
  return parse(vehicleIdSchema, input);
}

export function parseInventoryQuantityInput(input: unknown) {
  return parse(inventoryQuantitySchema, input);
}

export function parseListVehiclesQuery(input: unknown) {
  return parse(listVehiclesSchema, input);
}

export function parseSearchVehiclesQuery(input: unknown) {
  return parse(searchVehiclesSchema, input);
}

export function parseLowStockVehiclesQuery(input: unknown) {
  return parse(lowStockVehiclesSchema, input);
}
