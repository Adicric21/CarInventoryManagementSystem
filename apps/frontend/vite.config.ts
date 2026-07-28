import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, repositoryRoot, '');
  const backendOrigin =
    process.env['BACKEND_ORIGIN'] ?? `http://localhost:${environment['PORT'] ?? '3000'}`;

  return {
    plugins: [react()],
    envDir: repositoryRoot,
    server: {
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: 'coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.generated.{ts,tsx}',
          'src/test/**',
          'src/main.tsx',
        ],
      },
    },
  };
});
