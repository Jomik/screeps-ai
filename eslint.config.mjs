// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/', '**/coverage/'],
  },
  {
    linterOptions: {
      // Disabled to avoid flagging stale inline eslint-disable comments.
      // Enable and clean up directives when ready.
      reportUnusedDisableDirectives: 'off',
    },
  },
  eslint.configs.recommended,
  {
    // JS files run in Node
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2018,
      globals: globals.node,
    },
  },
  {
    // TypeScript files with type checking
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'require-yield': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description',
        },
      ],
      // Treat default case as exhaustive for union switches (e.g., RoomVisual.ts).
      '@typescript-eslint/switch-exhaustiveness-check': [
        'warn',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'with-single-extends',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
