import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'

const COMMAND = 'probeAcquire'

const SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local lease = tonumber(ARGV[1])

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - lease)

if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  return 0
end

redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], lease)

return 1
`

type Scripted = Redis & {
  [COMMAND]: (
    key: string,
    lease: string,
    limit: string,
    member: string
  ) => Promise<number>
}

export type ProbeLease = { release(): Promise<void> }

export class ProbeGate {
  private readonly logger = new Logger(ProbeGate.name)

  private readonly redis: Scripted

  private held = 0

  private degraded = false

  constructor(
    redis: Redis,
    private readonly key: string,
    private readonly limit: number,
    private readonly leaseMs: number
  ) {
    redis.defineCommand(COMMAND, { numberOfKeys: 1, lua: SCRIPT })

    this.redis = redis as Scripted
  }

  public async acquire(): Promise<ProbeLease | null> {
    if (this.held >= this.limit) {
      return null
    }

    this.held += 1

    const member = randomUUID()

    try {
      const granted = await this.redis[COMMAND](
        this.key,
        String(this.leaseMs),
        String(this.limit),
        member
      )

      this.recovered()

      if (!granted) {
        this.held -= 1

        return null
      }
    } catch (error) {
      this.degrade(error)
    }

    return { release: () => this.release(member) }
  }

  private async release(member: string): Promise<void> {
    this.held -= 1

    try {
      await this.redis.zrem(this.key, member)
    } catch (error) {
      this.degrade(error)
    }
  }

  private degrade(error: unknown): void {
    if (this.degraded) {
      return
    }

    this.degraded = true
    this.logger.error(
      'Redis is unreachable, probes are capped per process until it answers again',
      error
    )
  }

  private recovered(): void {
    if (!this.degraded) {
      return
    }

    this.degraded = false
    this.logger.log(
      'Redis answered again, probes are capped across every process'
    )
  }
}
