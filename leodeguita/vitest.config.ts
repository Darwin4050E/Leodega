import { mergeConfig } from 'vite'
import { defineConfig as defineVitestConfig } from 'vitest/config'
import viteConfig from './vite.config'

const WEBSTORAGE_OFF = '--no-experimental-webstorage'
const execArgv = process.allowedNodeEnvironmentFlags.has(WEBSTORAGE_OFF) ? [WEBSTORAGE_OFF] : []

export default mergeConfig(
  viteConfig,
  defineVitestConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['node_modules', 'dist'],
      execArgv,
    },
  }),
)
