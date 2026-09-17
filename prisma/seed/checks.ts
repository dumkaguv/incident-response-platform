import type { Db } from '@/core/prisma/utils/db'

const PER_MONITOR = 40
const MINUTE = 60_000

const FAILURES = [
  { errorType: 'TIMEOUT', statusCode: null },
  { errorType: 'DNS_ERROR', statusCode: null },
  { errorType: 'CONNECTION_REFUSED', statusCode: null },
  { errorType: 'INVALID_STATUS_CODE', statusCode: 503 }
] as const

function latency(index: number): number {
  return 80 + ((index * 37) % 420)
}

export async function seedChecks(
  db: Db,
  monitorIds: string[]
): Promise<number> {
  const start = Date.now()
  let written = 0

  for (const [position, monitorId] of monitorIds.entries()) {
    for (let index = 0; index < PER_MONITOR; index += 1) {
      const failing = (index + position) % 7 === 0
      const failure = FAILURES[(index + position) % FAILURES.length]
      const checkedAt = new Date(
        start - (index * PER_MONITOR + position) * MINUTE
      ).toISOString()

      await db.orm.public.MonitorCheck.create({
        monitorId,
        status: failing ? 'DOWN' : 'UP',
        statusCode: failing ? failure.statusCode : 200,
        responseTimeMs:
          failing && failure.statusCode === null
            ? null
            : latency(index + position),
        errorType: failing ? failure.errorType : null,
        checkedAt
      })

      written += 1
    }
  }

  return written
}
