import { defineConfig } from 'oxlint';

export default defineConfig({
  options: {
    typeAware: true,
  },

  // Ignore build output, coverage, and spec/test files.
  // Spec files use tsconfig.test.json which includes jest types and @types/screeps
  // test overrides. oxlint only accepts a single --tsconfig, so --type-check would
  // produce TS compiler errors on spec files when run with the production tsconfig.
  // Excluding them here ensures `--type-check` works correctly in workspace scripts.
  ignorePatterns: ['**/dist/', '**/coverage/', '**/*.spec.ts', '**/*.test.ts'],

  plugins: ['typescript'],

  // JS files: Node.js environment
  env: {
    node: true,
  },

  // Enable correctness and suspicious categories
  categories: {
    correctness: 'error',
    suspicious: 'warn',
  },

  rules: {
    // --- Ported from eslint.config.mjs ---

    // Generators used without yield in coroutine patterns (intentional in coroutine design)
    'require-yield': 'off',

    // Allow unused vars prefixed with _
    'typescript/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    // ts-ignore allowed with description
    'typescript/ban-ts-comment': [
      'error',
      {
        'ts-ignore': 'allow-with-description',
      },
    ],

    // Exhaustive switch with default counting as exhaustive
    'typescript/switch-exhaustiveness-check': [
      'warn',
      { considerDefaultExhaustiveForUnions: true },
    ],

    // Allow interfaces that extend a single type
    'typescript/no-empty-object-type': [
      'error',
      {
        allowInterfaces: 'with-single-extends',
      },
    ],

    // Future.then() is an intentional design for coroutine interop, not an
    // accidental thenable (it is never used in await expressions)
    'unicorn/no-thenable': 'off',

    'unicorn/no-useless-spread': 'warn',

    // TODO: re-enable and fix — no-shadow fires in many places with valid patterns
    'no-shadow': 'off',

    // TODO: re-enable and fix — consistent-return fires in spawn-manager routines
    'typescript/consistent-return': 'off',

    // ErrorMapper is a static-only utility class with cached state —
    // refactoring to standalone functions would lose the encapsulation
    'typescript/no-extraneous-class': 'off',

    // TODO: re-enable and fix — unsafe type assertions are used throughout
    'typescript/no-unsafe-type-assertion': 'off',

    'typescript/no-unnecessary-type-arguments': 'warn',

    'typescript/no-unnecessary-type-assertion': 'warn',

    'typescript/no-unnecessary-type-conversion': 'warn',

    'typescript/no-useless-default-assignment': 'warn',
  },
});
