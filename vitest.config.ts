import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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
        plugins: [react()],
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
      // Scope to modules with wired, executable logic. This list GROWS as each
      // layer lands (ipc handlers, preload bridge, renderer store, platform
      // adapters) so the 95% gate always reflects what has actually been built.
      // Type-only files (api-contract, hook-events), bootstrap (main/index,
      // container, renderer/main), and platform I/O shims are covered by
      // integration/E2E, not the unit gate.
      include: [
        'src/shared/result.ts',
        'src/core/**',
        'src/main/services/**',
        'src/main/ipc/**',
        'src/preload/create-bridge.ts',
        'src/renderer/store/**',
        'src/renderer/components/WorkbenchErrorBoundary.tsx',
        'src/renderer/components/Explorer.tsx'
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/index.html',
        // Native/IO adapter — lazily loads node-pty; verified via manual/E2E, not units.
        'src/main/services/pty-factory.ts'
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
