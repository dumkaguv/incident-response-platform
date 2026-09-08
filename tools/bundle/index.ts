import { rm } from 'node:fs/promises'

import { build } from 'esbuild'
import type { Plugin } from 'esbuild'

const REQUIRE_SHIM =
  "import { createRequire as nodeCreateRequire } from 'node:module';" +
  'const require = nodeCreateRequire(import.meta.url);'

const BARE_IMPORT = /^[^./]/

function externalizeUnresolved(reported: Set<string>): Plugin {
  return {
    name: 'externalize-unresolved',

    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: BARE_IMPORT }, async (args) => {
        if (args.pluginData === 'checked') {
          return null
        }

        const resolved = await pluginBuild.resolve(args.path, {
          importer: args.importer,
          kind: args.kind,
          resolveDir: args.resolveDir,
          pluginData: 'checked'
        })

        if (resolved.errors.length === 0) {
          return resolved
        }

        reported.add(args.path)

        return { path: args.path, external: true }
      })
    }
  }
}

async function main(): Promise<void> {
  await rm('bundle', { recursive: true, force: true })

  const externalized = new Set<string>()
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
    banner: { js: REQUIRE_SHIM },
    plugins: [externalizeUnresolved(externalized)]
  })

  for (const [file, meta] of Object.entries(result.metafile.outputs)) {
    console.warn(`${file} — ${(meta.bytes / 1024 / 1024).toFixed(2)} MB`)
  }

  if (externalized.size) {
    console.warn(
      `left external because they are not installed: ${[...externalized].sort().join(', ')}`
    )
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
