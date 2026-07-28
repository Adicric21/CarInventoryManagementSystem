import { z } from 'zod';

import { vehicleValidationError } from '../../vehicles/domain/vehicle-errors.js';

const positiveInteger = (maximum?: number) => {
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

const common = {
  vehicleId: z.string().uuid().optional(),
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  from: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .optional(),
  to: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .optional(),
  page: positiveInteger().default(1),
  limit: positiveInteger(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
};

const personalSchema = z
  .object(common)
  .strict()
  .refine(({ from, to }) => from === undefined || to === undefined || from <= to, {
    message: 'From must not be after to.',
    path: ['from'],
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    message: 'The requested page is outside the supported range.',
    path: ['page'],
  });

const adminSchema = z
  .object({ ...common, userId: z.string().uuid().optional() })
  .strict()
  .refine(({ from, to }) => from === undefined || to === undefined || from <= to, {
    message: 'From must not be after to.',
    path: ['from'],
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    message: 'The requested page is outside the supported range.',
    path: ['page'],
  });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = typeof issue.path[0] === 'string' ? issue.path[0] : 'request';
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    throw vehicleValidationError({ fields });
  }
  return result.data;
}

export const parsePersonalPurchaseQuery = (input: unknown) => parse(personalSchema, input);
export const parseAdminPurchaseQuery = (input: unknown) => parse(adminSchema, input);
