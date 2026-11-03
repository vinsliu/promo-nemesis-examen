const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

// Backend, gateway et microservices (Node, CommonJS). Le frontend utilise la config CRA.
module.exports = [
  { ignores: ['**/node_modules/**', 'frontend/**', 'audit/**', '**/build/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^(next|_)', caughtErrors: 'none', ignoreRestSiblings: true }] },
  },
  prettier,
];
