import unicorn from 'eslint-plugin-unicorn';

export const unicornEslint = {
  plugins: {
    unicorn,
  },
  rules: {
    ...unicorn.configs.recommended.rules,

    'unicorn/no-null': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/prefer-module': 'off',
  },
};
