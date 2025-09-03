import tseslint from 'typescript-eslint';
import airbnbBase from 'eslint-config-airbnb-base';
import pluginImport from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import perfectionist from 'eslint-plugin-perfectionist';
import unicorn from 'eslint-plugin-unicorn';

import customRules from './.eslintrc-rules/custom-rules.mjs';
import { orderedImportsEslint } from './.eslintrc-rules/ordered-imports.eslint.mjs';
import { perfectionistEslint } from './.eslintrc-rules/perfectionist.eslint.mjs';
import { securityEslint } from './.eslintrc-rules/security.eslint.mjs';
import { namingConventionEslint } from './.eslintrc-rules/naming-convention.eslint.mjs';
import { typescriptRecommendedEslint } from './.eslintrc-rules/typescript-recommended.eslint.mjs';
import { unicornEslint } from './.eslintrc-rules/unicorn.eslint.mjs';

export default [
  {
    ignores: ['eslint.config.*', 'vitest.config.*', 'tsup.config.*'],
  },

  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['./src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: pluginImport,
      'simple-import-sort': simpleImportSort,
      perfectionist,
      unicorn,
      ...securityEslint.plugins,
    },
    rules: {
      ...airbnbBase.rules,
      ...customRules,
      ...orderedImportsEslint.rules,
      ...perfectionistEslint.rules,
      ...securityEslint.rules,
      ...namingConventionEslint.rules,
      ...typescriptRecommendedEslint.rules,
      ...unicornEslint.rules,
    },
  },

  {
    files: ['./test/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
];
