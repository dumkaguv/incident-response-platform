import type { FastifyReply, FastifyRequest } from 'fastify'

import { type AppLocale, resolveLocale } from '@/core/i18n'

export type GqlContext = {
  req: FastifyRequest
  res: FastifyReply
  locale: AppLocale
  loaders: Map<string, unknown>
}

export function createGqlContext(
  req: FastifyRequest,
  res: FastifyReply
): GqlContext {
  return {
    req,
    res,
    locale: resolveLocale(req.headers['accept-language']),
    loaders: new Map()
  }
}
