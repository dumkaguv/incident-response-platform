export const QUEUE_DEFAULTS = {
  tickMs: 5000,
  batchSize: 50,
  concurrency: 8,
  attempts: 3,
  backoffMs: 1000
} as const

export const KEPT_COMPLETED = 1000
export const KEPT_FAILED = 5000
export const KEPT_TICKS = 100
