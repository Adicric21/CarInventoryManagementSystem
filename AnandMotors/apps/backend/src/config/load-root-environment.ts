import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

const rootEnvironmentPath = fileURLToPath(new URL('../../../../.env', import.meta.url));

export function loadRootEnvironment(): void {
  loadDotenv({ path: rootEnvironmentPath, quiet: true });
}
