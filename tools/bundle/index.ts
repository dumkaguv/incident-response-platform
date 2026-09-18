import { cp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { build } from 'esbuild'
import type { Plugin } from 'esbuild'

const CJS_SHIM =
  "import { createRequire as nodeCreateRequire } from 'node:module';" +
  "import { dirname as nodeDirname } from 'node:path';" +
  "import { fileURLToPath as nodeFileURLToPath } from 'node:url';" +
  'const require = nodeCreateRequire(import.meta.url);' +
  'const __filename = nodeFileURLToPath(import.meta.url);' +
  'const __dirname = nodeDirname(__filename);'

const BUNDLE_DIR = 'bundle'
const ENTRY_POINTS = {
  'lib/main': 'dist/main.js',
  'lib/worker': 'dist/worker/main.js'
}
const EXPLORER_ASSETS = join(
  dirname(createRequire(import.meta.url).resolve('mercurius')),
  'static'
)

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
  await rm(BUNDLE_DIR, { recursive: true, force: true })

  const externalized = new Set<string>()
  const result = await build({
    entryPoints: ENTRY_POINTS,
    outdir: BUNDLE_DIR,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    keepNames: true,
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
    banner: { js: CJS_SHIM },
    plugins: [externalizeUnresolved(externalized)]
  })

  await cp(EXPLORER_ASSETS, join(BUNDLE_DIR, 'static'), { recursive: true })

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
