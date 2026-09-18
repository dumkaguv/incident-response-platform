import { Logger } from '@nestjs/common'
import type { ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import type { Redis } from 'ioredis'

const COMMAND = 'throttlerIncrement'

const SCRIPT = `
local blocked = redis.call('PTTL', KEYS[2])

if blocked > 0 then
  local held = tonumber(redis.call('GET', KEYS[1])) or 0
  local alive = redis.call('PTTL', KEYS[1])

  if alive < 0 then alive = 0 end

  return { held, alive, 1, blocked }
end

local hits = redis.call('INCR', KEYS[1])
local alive = redis.call('PTTL', KEYS[1])

if alive < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  alive = tonumber(ARGV[1])
end

if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])

  return { hits, alive, 1, tonumber(ARGV[3]) }
end

return { hits, alive, 0, 0 }
`

type Tally = [number, number, number, number]

type Scripted = Redis & {
  [COMMAND]: (
    hits: string,
    blocked: string,
    ttl: string,
    limit: string,
    blockDuration: string
  ) => Promise<Tally>
}

const UNTHROTTLED: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0
}

function seconds(milliseconds: number): number {
  return Math.ceil(milliseconds / 1000)
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name)

  private readonly redis: Scripted

  private degraded = false

  constructor(
    redis: Redis,
    private readonly prefix: string
  ) {
    redis.defineCommand(COMMAND, { numberOfKeys: 2, lua: SCRIPT })

    this.redis = redis as Scripted
  }

  public async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const hits = `${this.prefix}:${throttlerName}:${key}`

    try {
      const [totalHits, timeToExpire, blocked, timeToBlockExpire] =
        await this.redis[COMMAND](
          hits,
          `${hits}:blocked`,
          String(ttl),
          String(limit),
          String(blockDuration)
        )

      this.recovered()

      return {
        totalHits,
        timeToExpire: seconds(timeToExpire),
        isBlocked: blocked === 1,
        timeToBlockExpire: seconds(timeToBlockExpire)
      }
    } catch (error) {
      this.degrade(error)

      return UNTHROTTLED
    }
  }

  private degrade(error: unknown): void {
    if (this.degraded) {
      return
    }

    this.degraded = true
    this.logger.error(
      'Redis is unreachable, rate limiting is open until it answers again',
      error
    )
  }

  private recovered(): void {
    if (!this.degraded) {
      return
    }

    this.degraded = false
    this.logger.log('Redis answered again, rate limiting is enforced')
  }
}
