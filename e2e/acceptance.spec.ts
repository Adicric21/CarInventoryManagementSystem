import type { Locator, Page } from '@playwright/test';

import { expect, test, type TestAccount } from './support/test-data.js';

async function login(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/vehicles$/u);
  await expect(page.getByRole('heading', { name: 'Vehicle catalogue' })).toBeVisible();
}

function vehicleCard(page: Page, name: string): Locator {
  return page.getByRole('article').filter({
    has: page.getByRole('heading', { name }),
  });
}

test('validates public authentication and protects anonymous inventory access', async ({
  page,
  testData,
}) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await expect(page.getByText('Email is required.')).toBeVisible();
  await expect(page.getByText('Password is required.')).toBeVisible();
  await expect(page.getByText('Please confirm your password.')).toBeVisible();

  const invalidAccount = testData.newAccount('Invalid E2E Login');
  await page.goto('/login');
  await page.getByLabel('Email').fill(invalidAccount.email);
  await page.getByLabel('Password').fill(invalidAccount.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');

  await page.goto('/vehicles');

  await expect(page).toHaveURL(/\/login$/u);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('USER can register, sign in, filter, purchase, and sign out without admin access', async ({
  page,
  testData,
}) => {
  const account = testData.newAccount('E2E Customer');
  const suffix = testData.marker.slice(-8);
  const make = `Apex-${suffix}`;
  const vehicleName = `${make} Roadster`;
  const conflictVehicleName = `${make} Conflict`;

  for (let index = 1; index <= 10; index += 1) {
    await testData.createVehicle({
      make,
      model: `Series ${String(index).padStart(2, '0')}`,
      category: 'Touring',
      price: 5_000_000 + index * 10_000,
      quantity: 1,
    });
  }

  await testData.createVehicle({
    make,
    model: 'Roadster',
    category: 'Performance',
    price: 4_850_000,
    quantity: 2,
  });
  const conflictVehicle = await testData.createVehicle({
    make,
    model: 'Conflict',
    category: 'Performance',
    price: 4_900_000,
    quantity: 1,
  });

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Name').fill(account.name);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password').fill(account.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/login$/u);
  await expect(page.getByText('Account created successfully. You can now sign in.')).toBeVisible();
  await login(page, account);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vehicle catalogue' })).toBeVisible();
  await expect(page.getByText(account.name, { exact: true })).toBeVisible();

  const filters = page.getByRole('form', { name: 'Search and filter vehicles' });
  await filters.getByLabel('Make', { exact: true }).fill(make);
  await filters.getByRole('button', { name: 'Apply filters' }).click();

  const card = vehicleCard(page, vehicleName);
  await expect(card).toBeVisible();
  await expect(card.getByText('Performance', { exact: true })).toBeVisible();
  await expect(card.getByText('₹48,50,000.00', { exact: true })).toBeVisible();
  await expect(card.getByText('Quantity: 2')).toBeVisible();
  await expect(page.getByText('Page 1 of 2 - 12 results')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 2 - 12 results')).toBeVisible();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('price');
  await page.getByRole('combobox', { name: 'Sort direction', exact: true }).selectOption('asc');
  await filters.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('article').first()).toContainText(vehicleName);

  expect(
    await page.evaluate(() => {
      const stored = window.localStorage.getItem('car-dealership-session');
      if (stored === null) {
        return true;
      }

      const session: unknown = JSON.parse(stored);
      const accessToken =
        typeof session === 'object' &&
        session !== null &&
        'accessToken' in session &&
        typeof session.accessToken === 'string'
          ? session.accessToken
          : '';

      return (
        accessToken === '' ||
        document.body.textContent?.includes(accessToken) === true ||
        window.location.href.includes(accessToken)
      );
    }),
  ).toBe(false);

  const purchaseRequestPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/purchase'),
  );
  await card.getByRole('button', { name: 'Purchase' }).click();
  const purchaseRequest = await purchaseRequestPromise;

  expect(purchaseRequest.headers()['authorization']?.startsWith('Bearer ')).toBe(true);
  expect(purchaseRequest.postDataJSON()).toEqual({ quantity: 1 });
  await expect(page.getByText('Vehicle purchased successfully.')).toBeVisible();
  await expect(card.getByText('Quantity: 1')).toBeVisible();

  await card.getByRole('button', { name: 'Purchase' }).click();
  await expect(card.getByText('Quantity: 0')).toBeVisible();
  await expect(card.getByText('Out of stock', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Purchase' })).toBeDisabled();

  const concurrentPurchaseStatus = await page.evaluate(async (vehicleId) => {
    const stored = window.localStorage.getItem('car-dealership-session');
    if (stored === null) {
      return 0;
    }

    const session: unknown = JSON.parse(stored);
    if (
      typeof session !== 'object' ||
      session === null ||
      !('accessToken' in session) ||
      typeof session.accessToken !== 'string'
    ) {
      return 0;
    }

    const response = await fetch(`/api/vehicles/${vehicleId}/purchase`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: 1 }),
    });

    return response.status;
  }, conflictVehicle.id);
  expect(concurrentPurchaseStatus).toBe(200);

  const conflictCard = vehicleCard(page, conflictVehicleName);
  await conflictCard.getByRole('button', { name: 'Purchase' }).click();
  await expect(conflictCard.getByText('Requested quantity exceeds available stock.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Vehicle' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Edit /u })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Restock /u })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete /u })).toHaveCount(0);

  await page.goto('/admin/vehicles/new');
  await expect(page).toHaveURL(/\/vehicles$/u);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/u);
  expect(
    await page.evaluate(() => window.localStorage.getItem('car-dealership-session')),
  ).toBeNull();
  await page.goto('/vehicles');
  await expect(page).toHaveURL(/\/login$/u);
});

test('ADMIN can create, edit, restock, and delete inventory before signing out', async ({
  page,
  testData,
}) => {
  const administrator = await testData.createAccount('ADMIN', 'E2E Administrator');
  const suffix = testData.marker.slice(-8);
  const make = 'Northstar';
  const originalModel = `Touring ${suffix}`;
  const updatedModel = `Executive ${suffix}`;
  const category = testData.marker;

  testData.trackVehicleCategory(category);
  await login(page, administrator);
  await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add Vehicle' }).click();
  let dialog = page.getByRole('dialog', { name: 'Add Vehicle' });
  await dialog.getByLabel('Make').fill(make);
  await dialog.getByLabel('Model').fill(originalModel);
  await dialog.getByLabel('Category').fill(category);
  await dialog.getByLabel('Price').fill('7250000');
  await dialog.getByLabel('Quantity').fill('2');
  await dialog.getByRole('button', { name: 'Add Vehicle' }).click();

  const originalName = `${make} ${originalModel}`;
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: originalName })).toBeVisible();

  await page.getByRole('link', { name: 'Low Stock' }).click();
  await expect(page).toHaveURL(/\/admin\/vehicles\/low-stock$/u);
  await expect(page.getByText(originalName, { exact: true })).toBeVisible();
  await expect(page.getByText('Low stock', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Catalogue', exact: true }).click();

  let card = vehicleCard(page, originalName);
  await card.getByRole('button', { name: `Edit ${originalName}` }).click();
  dialog = page.getByRole('dialog', { name: 'Edit Vehicle' });
  await dialog.getByLabel('Model').fill(updatedModel);
  await dialog.getByRole('button', { name: 'Save changes' }).click();

  const updatedName = `${make} ${updatedModel}`;
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();

  card = vehicleCard(page, updatedName);
  await card.getByRole('button', { name: `Restock ${updatedName}` }).click();
  dialog = page.getByRole('dialog', { name: 'Restock Vehicle' });
  await dialog.getByLabel('Restock quantity').fill('3');
  await dialog.getByRole('button', { name: 'Restock Vehicle' }).click();

  await expect(dialog).toBeHidden();
  await expect(card.getByText('Quantity: 5')).toBeVisible();

  await card.getByRole('button', { name: 'Purchase' }).click();
  await expect(card.getByText('Quantity: 4')).toBeVisible();

  await card.getByRole('button', { name: `Delete ${updatedName}` }).click();
  dialog = page.getByRole('dialog', { name: 'Delete Vehicle' });
  await expect(dialog.getByText(updatedName, { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete Vehicle' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: updatedName })).toHaveCount(0);
  await expect(page.getByText('Vehicle deleted successfully.')).toBeVisible();

  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page).toHaveURL(/\/admin\/inventory\/activity$/u);
  const activityTable = page.getByRole('table');
  await expect(activityTable.getByText('Vehicle deleted', { exact: true })).toBeVisible();
  await expect(activityTable.getByText(updatedName, { exact: true }).first()).toBeVisible();
  await expect(activityTable.getByText(administrator.name, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/u);
});
