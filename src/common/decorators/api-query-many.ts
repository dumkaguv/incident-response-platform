import { type ApiQueryOptions, ApiQuery } from '@nestjs/swagger'

import { DEFAULT_GET_QUERY } from '@/common/constants'

export function ApiQueryMany(
  queries: readonly ApiQueryOptions[] = DEFAULT_GET_QUERY
): MethodDecorator & ClassDecorator {
  return (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ) => {
    for (const query of queries) {
      if (!propertyKey || !descriptor) {
        return
      }

      ApiQuery(query)(target, propertyKey, descriptor)
    }
  }
}
