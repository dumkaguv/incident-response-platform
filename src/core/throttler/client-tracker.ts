import type { FastifyRequest } from 'fastify'

export type IdentifiedRequest = FastifyRequest & { user?: unknown }

export function clientTracker(request: IdentifiedRequest): string {
  const identified = identify(request.user)

  if (identified) {
    return `user:${identified}`
  }

  return `ip:${request.ips?.at(-1) ?? request.ip}`
}

function identify(user: unknown): string | null {
  if (typeof user === 'object' && user !== null && 'id' in user) {
    const { id } = user

    return typeof id === 'string' ? id : null
  }

  return null
}
