import perfectionist from 'eslint-plugin-perfectionist';

const defaultGroups = [
  'conditional',
  'function',
  'import',
  'intersection',
  'named',
  'keyword',
  'literal',
  'object',
  'operator',
  'tuple',
  'union',
  'nullish',
];

const sortGroup = {
  customGroups: {
    index: '^index$',
    path: '^path$',
    element: '^element$',
    key: '^key$',
    className: '^className$',
    classNames: '^classNames$',
    title: '^title$',
    message: '^message$',
    description: '^description$',
  },
  groups: ['index', 'path', 'element', 'key', 'className', 'classNames', 'title', 'message', 'description'],
};

export const perfectionistEslint = {
  plugins: {
    perfectionist,
  },
  rules: {
    ...perfectionist.configs['recommended-natural'].rules,
    'perfectionist/sort-imports': 'off',
    'perfectionist/sort-interfaces': 'off',
    'perfectionist/sort-jsx-props': [
      'error',
      sortGroup,
      {
        type: 'natural',
      },
    ],
    'perfectionist/sort-modules': 'off',
    'perfectionist/sort-objects': [
      'error',
      sortGroup,
      {
        newlinesBetween: 'always',
        partitionByComment: true,
        type: 'natural',
      },
    ],
    'perfectionist/sort-union-types': [
      'error',
      {
        groups: defaultGroups,
        type: 'natural',
      },
    ],
  },
};
