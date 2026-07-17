import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = {
  '@shared': resolve('src/shared'),
  '@core': resolve('src/core')
}

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{shared,core,main}/**/*.{test,spec}.ts']
        }
      },
      {
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/{renderer,preload}/**/*.{test,spec}.{ts,tsx}']
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      all: true,
      include: [
        'src/shared/**',
        'src/core/**',
        'src/main/services/**',
        'src/main/ipc/**',
        'src/preload/**',
        'src/renderer/store/**'
      ],
      exclude: [
        'src/main/index.ts',
        'src/main/container.ts',
        'src/main/platform/win32/**',
        'src/main/platform/posix/**',
        'src/renderer/main.tsx',
        '**/*.d.ts',
        '**/index.html'
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95
      }
    }
  }
})
