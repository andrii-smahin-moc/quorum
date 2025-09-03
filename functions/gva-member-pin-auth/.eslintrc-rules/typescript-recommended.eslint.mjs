import tseslint from 'typescript-eslint';

export const typescriptRecommendedEslint = tseslint.configs.recommended.concat(
  tseslint.configs.recommendedTypeChecked,
  {
    files: ['./src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      'no-useless-constructor': 'off',
      'no-shadow': 'off',
      'import/prefer-default-export': 'off',
    },
  },
  {
    files: ['./src/**/*.test.ts', './src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
