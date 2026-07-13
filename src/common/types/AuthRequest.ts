import type { Request } from 'express'

export type AuthRequest = {
  user: {
    id: number
    exp: number
    iat: number
  }
} & Request
