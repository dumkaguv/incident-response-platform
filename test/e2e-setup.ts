import { randomUUID } from 'node:crypto'

process.env.THROTTLE_KEY_PREFIX = `e2e-${randomUUID()}`
