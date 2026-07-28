import {
  loadRootEnvironment,
  parsePostgresUrl,
  requireSafeTestDatabaseUrl,
  runNpm,
} from './project-environment.mjs';

function requireValue(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function validateNodeVersion() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  const supported = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;

  if (!supported) {
    throw new Error('Node.js 20.19+ within Node 20, or Node.js 22.12+, is required.');
  }
}

function validateNpmVersion() {
  const userAgent = process.env['npm_config_user_agent'] ?? '';
  const majorVersion = Number(/(?:^|\s)npm\/(\d+)/u.exec(userAgent)?.[1]);

  if (!Number.isInteger(majorVersion) || majorVersion < 10) {
    throw new Error('npm 10 or later is required.');
  }
}

function validateApplicationEnvironment() {
  validateNodeVersion();
  validateNpmVersion();

  const developmentDatabaseUrl = requireValue('DATABASE_URL');
  const developmentDatabase = parsePostgresUrl(developmentDatabaseUrl, 'DATABASE_URL');
  const testDatabaseUrl = requireSafeTestDatabaseUrl();
  const testDatabase = parsePostgresUrl(testDatabaseUrl, 'TEST_DATABASE_URL');

  const documentedPlaceholders =
    /^(?:USER|PASSWORD|HOST|DATABASE|TEST_USER|TEST_PASSWORD|TEST_HOST|TEST_DATABASE)$/u;
  const databaseFields = [developmentDatabase, testDatabase].flatMap(({ databaseName, url }) =>
    [url.username, url.password, url.hostname, databaseName].map(decodeURIComponent),
  );

  if (databaseFields.some((field) => documentedPlaceholders.test(field))) {
    throw new Error('A PostgreSQL URL still contains a documented placeholder.');
  }

  const jwtSecret = requireValue('JWT_SECRET');

  if (jwtSecret.length < 32 || jwtSecret.startsWith('REPLACE_WITH_')) {
    throw new Error('JWT_SECRET must be a private random value of at least 32 characters.');
  }

  const jwtExpiry = Number(requireValue('JWT_EXPIRES_IN'));

  if (!Number.isInteger(jwtExpiry) || jwtExpiry <= 0) {
    throw new Error('JWT_EXPIRES_IN must be a positive integer in seconds.');
  }

  const adminName = requireValue('ADMIN_NAME');
  const adminEmail = requireValue('ADMIN_EMAIL');
  const adminPassword = requireValue('ADMIN_PASSWORD');

  if (adminName.startsWith('REPLACE_WITH_')) {
    throw new Error('ADMIN_NAME must replace the documented placeholder.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(adminEmail) || adminEmail.endsWith('.invalid')) {
    throw new Error('ADMIN_EMAIL must be a valid local administrator email.');
  }

  if (
    adminPassword.startsWith('REPLACE_WITH_') ||
    adminPassword.length < 8 ||
    !/[a-z]/u.test(adminPassword) ||
    !/[A-Z]/u.test(adminPassword) ||
    !/[0-9]/u.test(adminPassword) ||
    Buffer.byteLength(adminPassword, 'utf8') > 72
  ) {
    throw new Error(
      'ADMIN_PASSWORD must be 8-72 bytes and contain uppercase, lowercase, and number characters.',
    );
  }

  return testDatabaseUrl;
}

function runSetupStep(label, args, environment = process.env) {
  console.info(`\n[setup] ${label}`);
  runNpm(args, environment);
}

try {
  loadRootEnvironment();
  const testDatabaseUrl = validateApplicationEnvironment();

  runSetupStep('Installing locked dependencies', ['ci', '--include=dev']);
  runSetupStep('Applying development database migrations', ['run', 'db:migrate:deploy']);
  runSetupStep('Applying test database migrations', ['run', 'db:migrate:deploy'], {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
  });
  runSetupStep('Seeding the development administrator', ['run', 'db:seed']);
  runSetupStep('Installing Chromium for end-to-end tests', ['run', 'playwright:install']);

  console.info('\nSetup complete. Run `npm run dev` and open the URL printed by Vite.');
} catch (error) {
  console.error(`\nSetup failed: ${error instanceof Error ? error.message : 'Unknown error.'}`);
  process.exitCode = 1;
}
