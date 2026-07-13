import { SetMetadata } from '@nestjs/common'

export function ResponseMessage(message: string) {
  return SetMetadata('responseMessage', message)
}
