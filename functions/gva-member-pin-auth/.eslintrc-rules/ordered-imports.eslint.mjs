export const orderedImportsEslint = {
  rules: {
    'simple-import-sort/exports': 'error',
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          ['^node'],
          ['^@playwright'],
          ['^@?\\w'],
          ['^@config(/.*|$)?'],
          ['^@decorators(/.*|$)?'],
          ['^@fixtures(/.*|$)?'],
          ['^@interfaces(/.*|$)?'],
          ['^@models(/.*|$)?'],
          ['^@pages(/.*|$)?'],
          ['^@test-data(/.*|$)?'],
          ['^@tests(/.*|$)?'],
          ['^@utils(/.*|$)?'],
          ['^\\u0000'],
          ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
          ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
          ['^.+\\.?(css)$'],
        ],
      },
    ],
  },
};
