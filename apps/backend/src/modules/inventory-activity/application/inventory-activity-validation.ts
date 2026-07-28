import { z } from 'zod';

import { vehicleValidationError } from '../../vehicles/domain/vehicle-errors.js';
import { INVENTORY_ACTIVITY_ACTIONS } from '../domain/inventory-activity-types.js';

const positiveIntegerQuery = (maximum?: number) => {
  const numberSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
  const schema = z.union([
    numberSchema,
    z
      .string()
      .regex(/^[1-9]\d*$/u)
      .transform(Number)
      .pipe(numberSchema),
  ]);

  return maximum === undefined ? schema : schema.pipe(z.number().max(maximum));
};

const dateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const activityQuerySchema = z
  .object({
    action: z.enum(INVENTORY_ACTIVITY_ACTIONS).optional(),
    vehicleId: z.string().uuid().optional(),
    performedById: z.string().uuid().optional(),
    from: dateTime.optional(),
    to: dateTime.optional(),
    page: positiveIntegerQuery().default(1),
    limit: positiveIntegerQuery(100).default(20),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine(({ from, to }) => from === undefined || to === undefined || from <= to, {
    message: 'From must not be after to.',
    path: ['from'],
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    message: 'The requested page is outside the supported range.',
    path: ['page'],
  });

function validationDetails(error: z.ZodError): Readonly<Record<string, unknown>> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    const key = typeof field === 'string' ? field : 'request';
    fields[key] = [...(fields[key] ?? []), issue.message];
  }

  return { fields };
}

export function parseInventoryActivityQuery(input: unknown) {
  const result = activityQuerySchema.safeParse(input);

  if (!result.success) {
    throw vehicleValidationError(validationDetails(result.error));
  }

  return result.data;
}
