import tseslint from 'typescript-eslint';
import airbnbBase from 'eslint-config-airbnb-base';
import pluginImport from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import perfectionist from 'eslint-plugin-perfectionist';
import unicorn from 'eslint-plugin-unicorn';

import customRules from '../../.eslint/function/custom-rules.mjs';
import { orderedImportsEslint } from '../../.eslint/function/ordered-imports.eslint.mjs';
import { perfectionistEslint } from '../../.eslint/function//perfectionist.eslint.mjs';
import { securityEslint } from '../../.eslint/function/security.eslint.mjs';
import { namingConventionEslint } from '../../.eslint/function/naming-convention.eslint.mjs';
import { typescriptRecommendedEslint } from '../../.eslint/function//typescript-recommended.eslint.mjs';
import { unicornEslint } from '../../.eslint/function/unicorn.eslint.mjs';

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
