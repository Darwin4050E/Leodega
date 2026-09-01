import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Los specs de Cypress usan aserciones Chai en forma de getter
    // (`expect(x).to.exist`, `.to.not.be.empty`) que ESLint interpreta como
    // una expresión sin efecto porque no conoce los getters de Chai. Es el
    // mismo caso que resuelve `eslint-plugin-chai-friendly`; en vez de sumar
    // una dependencia nueva, se apaga la regla solo para estos archivos.
    files: ['cypress/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
])
