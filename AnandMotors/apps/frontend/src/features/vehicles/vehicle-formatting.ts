export function formatInr(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatDecimalInr(value: string): string {
  const [integer = '0', decimal = ''] = value.split('.');
  const lastThree = integer.slice(-3);
  const leading = integer.slice(0, -3);
  const groupedLeading = leading.replace(/\B(?=(\d{2})+(?!\d))/gu, ',');
  const groupedInteger = leading === '' ? lastThree : `${groupedLeading},${lastThree}`;
  return `₹${groupedInteger}.${decimal.padEnd(2, '0').slice(0, 2)}`;
}
