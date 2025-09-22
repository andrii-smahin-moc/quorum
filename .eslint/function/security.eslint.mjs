import pluginSecurity from 'eslint-plugin-security';

export const securityEslint = {
  plugins: {
    security: pluginSecurity,
  },
  rules: {
    ...pluginSecurity.configs.recommended.rules,
    'security/detect-object-injection': 'off',
  },
};
