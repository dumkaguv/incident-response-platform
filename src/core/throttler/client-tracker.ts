export function clientTracker(req: Record<string, unknown>): string {
  const identified = identify(req.user)

  if (identified) {
    return `user:${identified}`
  }

  const forwarded = req.ips

  if (Array.isArray(forwarded) && typeof forwarded[0] === 'string') {
    return `ip:${forwarded[0]}`
  }

  return typeof req.ip === 'string' ? `ip:${req.ip}` : 'ip:unknown'
}

function identify(user: unknown): string | null {
  if (typeof user === 'object' && user !== null && 'id' in user) {
    const { id } = user

    return typeof id === 'string' ? id : null
  }

  return null
}
