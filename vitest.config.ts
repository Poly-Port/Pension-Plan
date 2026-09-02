import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 계산 엔진 테스트는 DOM이 필요 없다. 화면 테스트 파일만 파일 상단에
    // `// @vitest-environment jsdom` 으로 환경을 올린다.
    environment: 'node',
  },
})
