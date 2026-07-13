export type PrismaException = {
  code: string
  meta?: {
    target?: string[] | string
  }
}

export function isPrismaException(e: unknown): e is PrismaException {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof e.code === 'string'
  )
}
