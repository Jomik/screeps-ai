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
      // ESLint 9 defaults to "warn"; match ESLint 8 behaviour (off) to avoid
      // flagging stale inline eslint-disable comments as new warnings.
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
      // Preserve v6 behavior: in typescript-eslint v6, the default case was
      // implicitly considered exhaustive for union types. v8 changed the default
      // to false, which would break existing code (e.g., RoomVisual.ts with union
      // type switches that rely on a default case). We explicitly set it to true
      // to maintain backward compatibility.
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
