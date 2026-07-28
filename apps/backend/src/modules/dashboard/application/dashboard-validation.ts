import { z } from 'zod';

import { vehicleValidationError } from '../../vehicles/domain/vehicle-errors.js';
import type { DashboardPeriod } from '../domain/dashboard-types.js';

const schema = z
  .object({
    period: z.enum(['7d', '30d', '90d']).default('30d'),
  })
  .strict();

export function parseDashboardQuery(input: unknown): { period: DashboardPeriod } {
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
