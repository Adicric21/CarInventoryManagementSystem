import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import {
  loadRootEnvironment,
  repositoryRoot,
  requireSafeTestDatabaseUrl,
} from './project-environment.mjs';

const backendOrigin = 'http://127.0.0.1:3100';
const frontendOrigin = 'http://127.0.0.1:4173';
const supportedProjects = new Set(['acceptance', 'screenshots']);
const startErrors = new WeakMap();

function delay(milliseconds) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

function startNodeProcess(label, arguments_, environment) {
  console.info(`[browser] Starting ${label}`);

  const childProcess = spawn(process.execPath, arguments_, {
    cwd: repositoryRoot,
    env: environment,
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });
  childProcess.once('error', (error) => {
    startErrors.set(childProcess, error);
  });

  return childProcess;
}

async function assertServerUnavailable(url, label) {
  let response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(500),
    });
  } catch {
    return;
  }

  await response.body?.cancel();
  throw new Error(`${label} URL is already in use: ${url}`);
}

async function waitForServer(url, label, childProcess) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const startError = startErrors.get(childProcess);

    if (startError !== undefined) {
      throw new Error(`${label} failed to start: ${startError.message}`);
    }

    if (childProcess.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready.`);
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2_000),
      });
      await response.body?.cancel();

      if (response.status < 500) {
        console.info(`[browser] ${label} is ready`);
        return;
      }
    } catch {
      // The bounded readiness loop retries until the server responds or the deadline expires.
    }

    await delay(250);
  }

  throw new Error(`${label} did not become ready within 120 seconds.`);
}

function waitForExit(childProcess, timeout) {
  if (childProcess.exitCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolveExit) => {
    const handleExit = () => {
      clearTimeout(timer);
      resolveExit(true);
    };
    const timer = setTimeout(() => {
      childProcess.off('exit', handleExit);
      resolveExit(false);
    }, timeout);

    childProcess.once('exit', handleExit);
  });
}

async function stopProcess(childProcess, label) {
  if (childProcess === undefined || childProcess.exitCode !== null) {
    return;
  }

  console.info(`[browser] Stopping ${label}`);
  childProcess.kill('SIGTERM');

  if (await waitForExit(childProcess, 3_000)) {
    return;
  }

  if (process.platform === 'win32' && childProcess.pid !== undefined) {
    spawnSync('taskkill', ['/PID', String(childProcess.pid), '/T', '/F'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    childProcess.kill('SIGKILL');
  }

  if (!(await waitForExit(childProcess, 3_000))) {
    childProcess.unref();
    throw new Error(`${label} did not stop cleanly.`);
  }
}

function runPlaywright(project) {
  const cliPath = resolve(repositoryRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  const childProcess = spawn(process.execPath, [cliPath, 'test', `--project=${project}`], {
    cwd: repositoryRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });

  return new Promise((resolveRun, rejectRun) => {
    childProcess.once('error', rejectRun);
    childProcess.once('exit', (code, signal) => {
      if (signal !== null) {
        rejectRun(new Error(`Playwright exited after receiving ${signal}.`));
        return;
      }

      resolveRun(code ?? 1);
    });
  });
}

const project = process.argv[2];

if (project === undefined || !supportedProjects.has(project)) {
  console.error('Specify the acceptance or screenshots Playwright project.');
  process.exitCode = 1;
} else {
  loadRootEnvironment();
  const testDatabaseUrl = requireSafeTestDatabaseUrl();
  let backend;
  let frontend;

  try {
    await assertServerUnavailable(`${backendOrigin}/api/vehicles`, 'backend');
    await assertServerUnavailable(`${frontendOrigin}/login`, 'frontend');

    backend = startNodeProcess(
      'backend',
      [resolve(repositoryRoot, 'apps', 'backend', 'dist', 'index.js')],
      {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        JWT_SECRET: randomBytes(48).toString('base64url'),
        JWT_EXPIRES_IN: '3600',
        NODE_ENV: 'test',
        PORT: '3100',
      },
    );
    await waitForServer(`${backendOrigin}/api/vehicles`, 'backend', backend);

    frontend = startNodeProcess(
      'frontend',
      [
        resolve(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
        resolve(repositoryRoot, 'apps', 'frontend'),
        '--config',
        resolve(repositoryRoot, 'apps', 'frontend', 'vite.config.ts'),
        '--host',
        '127.0.0.1',
        '--port',
        '4173',
        '--strictPort',
      ],
      {
        ...process.env,
        BACKEND_ORIGIN: backendOrigin,
        VITE_API_BASE_URL: '/api',
      },
    );
    await waitForServer(`${frontendOrigin}/login`, 'frontend', frontend);

    const exitCode = await runPlaywright(project);
    process.exitCode = exitCode;
  } catch (error) {
    console.error(
      `[browser] ${error instanceof Error ? error.message : 'The browser test run failed.'}`,
    );
    process.exitCode = 1;
  } finally {
    const cleanupResults = await Promise.allSettled([
      stopProcess(frontend, 'frontend'),
      stopProcess(backend, 'backend'),
    ]);

    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        console.error(
          `[browser] ${result.reason instanceof Error ? result.reason.message : 'Server cleanup failed.'}`,
        );
        process.exitCode = 1;
      }
    }
  }
}
