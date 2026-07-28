export async function captureExpectedInventoryError(
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }

  throw new Error('Expected the inventory operation to fail');
}
