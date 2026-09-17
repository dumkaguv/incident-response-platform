import { z } from 'zod'

import { HTTP_TIER, THROTTLE_TIERS } from '@/core/throttler/throttler.constants'

function withoutBlanks(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) {
    return raw
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([, value]) => value !== ''
    )
  )
}

function positive(fallback: number) {
  return z.coerce.number().int().positive().default(fallback)
}

export const envSchema = z.preprocess(
  withoutBlanks,
  z.object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: positive(3000),
    DATABASE_URL: z.url(),
    GRAPHIQL: z.stringbool().optional(),
    TRUST_PROXY: z.string().min(1).optional(),
    THROTTLE_HTTP_LIMIT: positive(HTTP_TIER.limit),
    THROTTLE_BURST_LIMIT: positive(THROTTLE_TIERS.burst.limit),
    THROTTLE_SUSTAINED_LIMIT: positive(THROTTLE_TIERS.sustained.limit),
    THROTTLE_HOURLY_LIMIT: positive(THROTTLE_TIERS.hourly.limit)
  })
)

export type Env = z.infer<typeof envSchema>

export function parseEnv(raw: Record<string, unknown>): Env {
  return envSchema.parse(raw)
}

export function env(): Env {
  return envSchema.parse(process.env)
}
