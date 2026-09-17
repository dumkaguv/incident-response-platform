import { env } from './env.schema'

export function isDev(): boolean {
  return env().NODE_ENV !== 'production'
}
