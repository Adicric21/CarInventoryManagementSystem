import { z } from 'zod';

const MAX_VEHICLE_PRICE = 999_999_999_999.99;
const MAX_VEHICLE_QUANTITY = 2_147_483_647;

const requiredVehicleText = (field: string) =>
  z.string().trim().min(1, `${field} is required.`).max(100, `${field} is too long.`);

const priceInput = z
  .string()
  .trim()
  .min(1, 'Price is required.')
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
    message: 'Price must be greater than zero.',
  })
  .refine((value) => Number(value) <= MAX_VEHICLE_PRICE, {
    message: 'Price is too large.',
  })
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: 'Price must have at most two decimal places.',
  });

const inventoryQuantityInput = z
  .string()
  .trim()
  .min(1, 'Quantity is required.')
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
    message: 'Quantity must be non-negative.',
  })
  .refine((value) => Number.isInteger(Number(value)), {
    message: 'Quantity must be an integer.',
  })
  .refine((value) => Number(value) <= MAX_VEHICLE_QUANTITY, {
    message: 'Quantity exceeds the supported range.',
  });

export const vehicleFormSchema = z.object({
  make: requiredVehicleText('Make'),
  model: requiredVehicleText('Model'),
  category: requiredVehicleText('Category'),
  price: priceInput,
  quantity: inventoryQuantityInput,
});

export type VehicleFormValues = z.input<typeof vehicleFormSchema>;

export const restockSchema = z.object({
  quantity: z
    .string()
    .trim()
    .min(1, 'Quantity is required.')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'Quantity must be greater than zero.',
    })
    .refine((value) => Number.isInteger(Number(value)), {
      message: 'Quantity must be an integer.',
    })
    .refine((value) => Number(value) <= MAX_VEHICLE_QUANTITY, {
      message: 'Quantity exceeds the supported range.',
    }),
});

export type RestockFormValues = z.input<typeof restockSchema>;
