import { fileURLToPath } from 'node:url'

import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const sourceRoot = `${projectRoot}src`

const graphqlEntry = fileURLToPath(import.meta.resolve('graphql'))

const swcTransform = swc.vite({
  swcrc: false,
  configFile: false,
  tsconfigFile: false,
  module: { type: 'es6' },
  jsc: {
    target: 'es2023',
    parser: {
      syntax: 'typescript',
      decorators: true,
      dynamicImport: true
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
      useDefineForClassFields: false
    },
    keepClassNames: true,
    experimental: {
      plugins: [['@lingui/swc-plugin', {}]]
    }
  }
})

const databaseBound = {
  fileParallelism: false,
  testTimeout: 30_000,
  hookTimeout: 30_000
}

export default defineConfig({
  plugins: [swcTransform],

  resolve: {
    alias: [
      { find: /^@\//, replacement: `${sourceRoot}/` },
      { find: /^~\//, replacement: projectRoot },
      { find: /^graphql$/, replacement: graphqlEntry }
    ]
  },

  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.spec.ts'],
          pool: 'threads',
          isolate: false
        }
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          ...databaseBound
        }
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.integration-spec.ts'],
          ...databaseBound
        }
      }
    ]
  }
})
