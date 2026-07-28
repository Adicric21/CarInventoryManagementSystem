import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const rootEnvironmentPath = fileURLToPath(new URL('../.env', import.meta.url));

export function loadRootEnvironment({ required = false } = {}) {
  if (!existsSync(rootEnvironmentPath)) {
    if (required) {
      throw new Error(
        'Root .env file is missing. Copy .env.example to .env and replace every placeholder.',
      );
    }

    return false;
  }

  loadEnvFile(rootEnvironmentPath);
  return true;
}

export function parsePostgresUrl(value, variableName) {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${variableName} is required.`);
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`${variableName} must use the postgres or postgresql protocol.`);
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (databaseName === '') {
    throw new Error(`${variableName} must include a database name.`);
  }

  return { databaseName, url };
}

export function requireSafeTestDatabaseUrl() {
  const value = process.env['TEST_DATABASE_URL'];
  const parsed = parsePostgresUrl(value, 'TEST_DATABASE_URL');

  if (!/(?:^|[_-])test(?:$|[_-])/u.test(parsed.databaseName.toLowerCase())) {
    throw new Error(
      'TEST_DATABASE_URL must identify a dedicated database with a test segment in its name.',
    );
  }

  const developmentValue = process.env['DATABASE_URL'];

  if (developmentValue !== undefined) {
    parsePostgresUrl(developmentValue, 'DATABASE_URL');

    if (databaseIdentity(developmentValue) === databaseIdentity(value)) {
      throw new Error('TEST_DATABASE_URL must not identify the DATABASE_URL database.');
    }
  }

  return value;
}

export function databaseIdentity(url) {
  const parsed = new URL(url);
  const port = parsed.port === '' ? '5432' : parsed.port;
  const databaseName = decodeURIComponent(parsed.pathname.slice(1)).toLowerCase();

  return `${parsed.hostname.toLowerCase()}:${port}/${databaseName}`;
}

export function runNpm(args, environment = process.env) {
  const npmCliPath = process.env['npm_execpath'];

  if (npmCliPath === undefined) {
    throw new Error('Run this command through an npm script so npm can be located safely.');
  }

  const result = spawnSync(process.execPath, [npmCliPath, ...args], {
    cwd: repositoryRoot,
    env: environment,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm command failed with exit code ${result.status ?? 1}.`);
  }
}
