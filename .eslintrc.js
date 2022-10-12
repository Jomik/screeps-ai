/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2018,
  },
  ignorePatterns: ['dist/', 'coverage/'],
  extends: ['eslint:recommended', 'prettier'],
  overrides: [
    {
      // Handle js files, these runs on our local machine in node.
      files: '*.js',
      env: {
        node: true,
      },
    },
    {
      // Handle typescript files
      files: '*.ts',
      parser: '@typescript-eslint/parser',
      parserOptions: {
        // @ts-ignore we know __dirname exists
        tsconfigRootDir: __dirname,
        project: ['./packages/*/tsconfig.json'],
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
      ],
      rules: {
        'require-yield': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-ignore': 'allow-with-description',
          },
        ],
        '@typescript-eslint/switch-exhaustiveness-check': 'warn',
        '@typescript-eslint/no-empty-interface': [
          'error',
          {
            allowSingleExtends: true,
          },
        ],
      },
    },
  ],
};

module.exports = config;
