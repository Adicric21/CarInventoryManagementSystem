import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const rootEnvironmentPath = fileURLToPath(new URL('./.env', import.meta.url));

if (existsSync(rootEnvironmentPath)) {
  loadEnvFile(rootEnvironmentPath);
}

function requireSafeTestDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];

  if (value === undefined || value.trim() === '') {
    throw new Error(
      'TEST_DATABASE_URL is required for E2E tests. Configure a dedicated PostgreSQL test database.',
    );
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  const isPostgres = url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  const isClearlyTestDatabase = /(?:^|[_-])test(?:$|[_-])/u.test(databaseName);

  if (!isPostgres || !isClearlyTestDatabase) {
    throw new Error('TEST_DATABASE_URL must identify a dedicated PostgreSQL test database.');
  }

  const developmentValue = process.env['DATABASE_URL'];

  if (developmentValue !== undefined) {
    let developmentUrl: URL;

    try {
      developmentUrl = new URL(developmentValue);
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL URL when configured.');
    }

    const normalize = (databaseUrl: URL): string => {
      const port = databaseUrl.port === '' ? '5432' : databaseUrl.port;
      const name = decodeURIComponent(databaseUrl.pathname.slice(1)).toLowerCase();
      return `${databaseUrl.hostname.toLowerCase()}:${port}/${name}`;
    };

    if (normalize(developmentUrl) === normalize(url)) {
      throw new Error('TEST_DATABASE_URL must not identify the DATABASE_URL database.');
    }
  }

  return value;
}

requireSafeTestDatabaseUrl();
const frontendOrigin = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  forbidOnly: process.env['CI'] === 'true',
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: frontendOrigin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'acceptance',
      testMatch: /acceptance\.spec\.ts/u,
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/u,
    },
  ],
});
