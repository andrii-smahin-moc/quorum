export const namingConventionEslint = {
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      {
        format: ['camelCase', 'snake_case', 'PascalCase', 'UPPER_CASE'],
        selector: 'objectLiteralProperty',
        leadingUnderscore: 'allow',
      },
      {
        format: null,
        modifiers: ['requiresQuotes'],
        selector: [
          'classProperty',
          'objectLiteralProperty',
          'typeProperty',
          'classMethod',
          'objectLiteralMethod',
          'typeMethod',
          'accessor',
          'enumMember',
        ],
      },
      {
        format: ['PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        modifiers: ['public', 'static'],
        selector: 'memberLike',
      },
      {
        format: ['PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'forbid',
        modifiers: ['private', 'static'],
        selector: 'memberLike',
      },
      {
        format: ['camelCase', 'snake_case'],
        leadingUnderscore: 'allow',
        modifiers: ['public'],
        selector: 'memberLike',
      },
      {
        format: ['camelCase'],
        leadingUnderscore: 'forbid',
        modifiers: ['private'],
        selector: 'memberLike',
      },
      {
        format: ['UPPER_CASE'],
        leadingUnderscore: 'forbid',
        modifiers: ['private', 'readonly'],
        selector: 'memberLike',
      },
      {
        format: ['camelCase'],
        leadingUnderscore: 'require',
        modifiers: ['protected'],
        selector: 'memberLike',
      },
      {
        format: ['camelCase', 'snake_case'],
        leadingUnderscore: 'allow',
        selector: 'parameter',
      },
      {
        format: ['UPPER_CASE'],
        selector: 'enumMember',
      },
      {
        format: ['PascalCase'],
        selector: 'class',
      },
      {
        format: ['camelCase', 'UPPER_CASE'],
        selector: 'variable',
      },
      {
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
        modifiers: ['const', 'global'],
        selector: 'variable',
      },
      {
        format: ['PascalCase', 'camelCase', 'snake_case'],
        leadingUnderscore: 'allow',
        modifiers: ['destructured'],
        selector: 'variable',
      },
      {
        format: ['PascalCase'],
        prefix: ['is', 'should', 'has', 'can', 'did', 'will'],
        selector: 'variable',
        types: ['boolean'],
      },
      {
        format: null,
        modifiers: ['destructured'],
        selector: 'variable',
        types: ['boolean'],
      },
      {
        filter: {
          match: true,
          regex: '^\\w*Component$',
        },
        format: ['PascalCase'],
        selector: 'variable',
      },
      {
        format: ['camelCase', 'snake_case'],
        leadingUnderscore: 'allow',
        modifiers: ['destructured'],
        selector: 'parameter',
      },
      {
        format: ['PascalCase', 'camelCase'],
        leadingUnderscore: 'allow',
        selector: 'function',
      },
      {
        format: ['PascalCase', 'camelCase'],
        leadingUnderscore: 'allow',
        modifiers: ['exported', 'global'],
        selector: 'function',
      },
      {
        format: ['camelCase'],
        selector: 'function',
      },
    ],
  },
};
