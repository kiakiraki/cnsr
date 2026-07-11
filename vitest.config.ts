import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      // .vueはmountテスト導入まで対象外（v8プロバイダが生SFCをパースできずPARSE_ERRORになる）
      include: ['composables/**/*.ts', 'utils/**/*.ts'],
      reporter: ['text', 'html'],
      // 現状値(約53/46/46/55%)から回帰しないための下限。向上に合わせて引き上げる
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 40,
        lines: 50,
      },
    },
  },
})
