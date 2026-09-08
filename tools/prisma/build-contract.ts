import { glob, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const FRAGMENTS = 'src/modules/*/*.prisma'
const CONTRACT = 'src/prisma/contract.prisma'
const DIALECT = '// use prisma-next'

async function fragmentPaths(): Promise<string[]> {
  const paths: string[] = []

  for await (const path of glob(FRAGMENTS)) {
    paths.push(path.replaceAll('\\', '/'))
  }

  return paths.sort()
}

export async function buildContract(): Promise<string[]> {
  const paths = await fragmentPaths()

  if (paths.length === 0) {
    throw new Error(`No contract fragments matched ${FRAGMENTS}`)
  }

  const fragments = await Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, 'utf8')

      return source.replace(DIALECT, '').trim()
    })
  )

  await mkdir(dirname(CONTRACT), { recursive: true })
  await writeFile(CONTRACT, `${DIALECT}\n\n${fragments.join('\n\n')}\n`)

  return paths
}

const paths = await buildContract()

console.warn(`Built ${CONTRACT} from ${String(paths.length)} fragment(s)`)
