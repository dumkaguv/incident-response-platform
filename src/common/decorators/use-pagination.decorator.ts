import { SetMetadata } from '@nestjs/common'

export function UsePagination() {
  return SetMetadata('usePagination', true)
}
