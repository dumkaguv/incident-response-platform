import type { Request, Response } from 'express'

import { type AppLocale, resolveLocale } from '@/core/i18n'

export type GqlContext = {
  req: Request
  res: Response
  locale: AppLocale
  loaders: Map<string, unknown>
}

export function createGqlContext(req: Request, res: Response): GqlContext {
  return {
    req,
    res,
    locale: resolveLocale(req.headers['accept-language']),
    loaders: new Map()
  }
}
