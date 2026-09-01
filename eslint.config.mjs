import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '*.config.mjs'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // TypeORM and Nest decorators return `any` in enough places that the
      // unsafe-* family is noise; explicit-any above covers the real risk.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // -------------------------------------------------------------------------
  // The identity boundary. See docs/IMPLEMENTATION-PLAN.md section 3.10.
  //
  // Only src/auth/ may import the auth provider. Everywhere else consumes it
  // through AuthProvider and the decorators in auth/decorators/, so replacing
  // the provider touches one folder instead of forty-five files.
  // -------------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    ignores: ['src/auth/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['better-auth', 'better-auth/*', '@thallesp/*'],
              message:
                'Identity is consumed through AuthProvider and the decorators in auth/. See docs/IMPLEMENTATION-PLAN.md 3.10.',
            },
          ],
        },
      ],
    },
  },

  // Tests may be looser: `any` in a fixture is not the same risk as `any` in
  // a service, and forbidding it makes people write worse fixtures.
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
