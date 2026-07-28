import { loadRootEnvironment, requireSafeTestDatabaseUrl, runNpm } from './project-environment.mjs';

try {
  loadRootEnvironment();
  const testDatabaseUrl = requireSafeTestDatabaseUrl();

  runNpm(['run', 'db:migrate:deploy'], {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to migrate the test database.');
  process.exitCode = 1;
}
