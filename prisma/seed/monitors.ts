import type { Db } from '@/core/prisma/utils/db'

const MONITORS = [
  {
    name: 'Example homepage',
    url: 'https://example.com',
    method: 'GET',
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    isActive: true
  },
  {
    name: 'Example health endpoint',
    url: 'https://example.com/health',
    method: 'GET',
    intervalSeconds: 30,
    timeoutMs: 3000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    isActive: true
  },
  {
    name: 'Httpbin status probe',
    url: 'https://httpbin.org/status/200',
    method: 'GET',
    intervalSeconds: 120,
    timeoutMs: 8000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    isActive: true
  },
  {
    name: 'Httpbin slow endpoint',
    url: 'https://httpbin.org/delay/2',
    method: 'GET',
    intervalSeconds: 300,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    isActive: true
  },
  {
    name: 'Unreachable host',
    url: 'https://does-not-resolve.invalid',
    method: 'GET',
    intervalSeconds: 600,
    timeoutMs: 2000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    isActive: false
  },
  {
    name: 'Head-only probe',
    url: 'https://example.com',
    method: 'HEAD',
    intervalSeconds: 900,
    timeoutMs: 4000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    isActive: true
  }
] as const

export async function seedMonitors(db: Db): Promise<string[]> {
  const ids: string[] = []

  for (const monitor of MONITORS) {
    const row = await db.orm.public.Monitor.create({ ...monitor })

    ids.push(row.id)
  }

  return ids
}
