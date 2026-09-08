import { rm } from 'node:fs/promises'

import { build } from 'esbuild'

const OPTIONAL_PEERS = [
  '@apollo/gateway',
  '@apollo/subgraph',
  '@as-integrations/fastify',
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module.js',
  '@nestjs/websockets/socket-module.js',
  'ts-morph'
]

const REQUIRE_SHIM =
  "import { createRequire as nodeCreateRequire } from 'node:module';" +
  'const require = nodeCreateRequire(import.meta.url);'

async function main(): Promise<void> {
  await rm('bundle', { recursive: true, force: true })

  const result = await build({
    entryPoints: ['dist/main.js'],
    outfile: 'bundle/main.mjs',
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    keepNames: true,
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
    external: OPTIONAL_PEERS,
    banner: { js: REQUIRE_SHIM }
  })

  const outputs = Object.entries(result.metafile.outputs)

  for (const [file, meta] of outputs) {
    console.warn(`${file} — ${(meta.bytes / 1024 / 1024).toFixed(2)} MB`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
