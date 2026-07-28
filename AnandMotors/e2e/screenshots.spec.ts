import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';

import { expect, test, type TestAccount } from './support/test-data.js';

const screenshotDirectory = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));

async function login(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Vehicle catalogue' })).toBeVisible();
}

async function capture(page: Page, fileName: string): Promise<void> {
  await page.evaluate(async () => document.fonts.ready);
  await page.screenshot({
    path: resolve(screenshotDirectory, fileName),
    fullPage: true,
    animations: 'disabled',
  });
}

function vehicleCard(page: Page, name: string) {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name }) });
}

test.use({ viewport: { width: 1440, height: 1000 } });

test('captures populated application features for project documentation', async ({
  page,
  testData,
}, testInfo) => {
  await mkdir(screenshotDirectory, { recursive: true });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await capture(page, 'login.png');

  const customer = await testData.createAccount('USER', 'Demo Customer', 'demo.customer');
  const administrator = await testData.createAccount('ADMIN', 'Demo Administrator', 'demo.admin');
  const collection = 'Signature Collection';
  const demoVehicles = [
    {
      make: 'Aurora',
      model: 'Anand',
      category: `${collection} Grand Touring`,
      price: 7_950_000,
      quantity: 3,
    },
    {
      make: 'Meridian',
      model: 'Atlas',
      category: `${collection} Luxury SUV`,
      price: 9_850_000,
      quantity: 5,
    },
    {
      make: 'Solace',
      model: 'E1',
      category: `${collection} Electric`,
      price: 6_400_000,
      quantity: 2,
    },
  ] as const;

  for (const vehicle of demoVehicles) {
    await testData.createVehicle(vehicle);
  }

  await login(page, customer);
  let filters = page.getByRole('form', { name: 'Search and filter vehicles' });
  await filters.getByLabel('Category', { exact: true }).fill(collection);
  await filters.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('heading', { name: 'Aurora Anand' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meridian Atlas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solace E1' })).toBeVisible();
  await capture(page, 'user-catalogue.png');

  await vehicleCard(page, 'Aurora Anand').getByRole('button', { name: 'Purchase' }).click();
  await expect(page.getByText('Vehicle purchased successfully.')).toBeVisible();
  await vehicleCard(page, 'Solace E1').getByRole('button', { name: 'Purchase' }).click();
  await expect(page.getByText('Vehicle purchased successfully.')).toBeVisible();
  await page.getByRole('link', { name: 'My Purchases' }).click();
  await expect(page.getByRole('heading', { name: 'My purchases' })).toBeVisible();
  await expect(page.getByText('Aurora Anand').first()).toBeVisible();
  await expect(page.getByText('Solace E1')).toBeVisible();
  await capture(page, 'user-purchase-history.png');

  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page, administrator);
  filters = page.getByRole('form', { name: 'Search and filter vehicles' });
  await filters.getByLabel('Category', { exact: true }).fill(collection);
  await filters.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('button', { name: 'Add Vehicle' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Aurora Anand' })).toBeVisible();
  await capture(page, 'admin-inventory.png');

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Administrator dashboard' })).toBeVisible();
  await expect(page.getByText('Purchase Revenue')).toBeVisible();
  await expect(page.getByText('Aurora Anand').first()).toBeVisible();
  await capture(page, 'admin-dashboard.png');

  await page.getByRole('link', { name: 'Low Stock' }).click();
  await expect(page.getByRole('heading', { name: 'Low-stock vehicles' })).toBeVisible();
  await expect(page.getByText('Aurora Anand').first()).toBeVisible();
  await expect(page.getByText('Solace E1')).toBeVisible();
  await capture(page, 'admin-low-stock.png');

  await page.getByRole('link', { name: 'Purchases' }).click();
  await expect(page.getByRole('heading', { name: 'Purchase history' })).toBeVisible();
  await expect(page.getByText('Demo Customer').first()).toBeVisible();
  await capture(page, 'admin-purchase-history.png');

  await page.getByRole('link', { name: 'Import/Export' }).click();
  await expect(page.getByRole('heading', { name: 'Import and export vehicles' })).toBeVisible();
  const importCategory = `New Arrivals ${testData.marker.slice(-6)}`;
  testData.trackVehicleCategory(importCategory);
  await page.getByLabel('CSV file').setInputFiles({
    name: 'new-arrivals.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'make,model,category,price,quantity',
        `Veridian,Apex,${importCategory},8750000,4`,
        `Crestline,Terra,${importCategory},9250000,6`,
      ].join('\n'),
    ),
  });
  await page.getByRole('button', { name: 'Preview CSV' }).click();
  await expect(page.getByText('2 valid rows')).toBeVisible();
  await capture(page, 'admin-csv-preview.png');
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByText('Imported 2 vehicles.')).toBeVisible();

  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory activity' })).toBeVisible();
  const activityTable = page.getByRole('table');
  await expect(activityTable.getByText('Vehicle created').first()).toBeVisible();
  await expect(activityTable.getByText('Vehicle purchased').first()).toBeVisible();
  await capture(page, 'admin-activity-log.png');

  await page.getByRole('link', { name: 'Catalogue', exact: true }).click();
  filters = page.getByRole('form', { name: 'Search and filter vehicles' });
  await filters.getByLabel('Category', { exact: true }).fill(collection);
  await filters.getByRole('button', { name: 'Apply filters' }).click();

  for (const viewport of [
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ] as const) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: 'Vehicle catalogue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Vehicle' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aurora Anand' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-admin-review.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
});
