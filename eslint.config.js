import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/.vite/',
    '**/generated/',
    '**/*.generated.*',
    '**/*.tsbuildinfo',
    '**/package-lock.json',
    '.husky/_/',
  ]),
  {
    name: 'project/base',
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    name: 'project/typescript',
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['apps/backend/prisma.config.ts'],
          defaultProject: 'apps/backend/tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    name: 'project/node',
    files: [
      'apps/backend/**/*.{js,mjs,cjs,ts,mts,cts}',
      'apps/frontend/vite.config.ts',
      'e2e/**/*.{js,mjs,cjs,ts,mts,cts}',
      'scripts/**/*.{js,mjs,cjs,ts,mts,cts}',
      'playwright.config.ts',
      '*.{js,mjs,cjs}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: 'project/frontend',
    files: ['apps/frontend/src/**/*.{js,jsx,ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    name: 'project/frontend-react',
    files: ['apps/frontend/src/**/*.{jsx,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended, reactRefresh.configs.vite()],
  },
  prettierConfig,
]);
