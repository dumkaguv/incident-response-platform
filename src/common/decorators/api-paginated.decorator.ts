/* eslint-disable @typescript-eslint/no-explicit-any */

import { applyDecorators } from '@nestjs/common'

import { ApiQueryMany } from './api-query-many'
import { ApiOkResponseWrapped } from './api-response.decorator'
import { UsePagination } from './use-pagination.decorator'

export function ApiPaginated(model: any) {
  return applyDecorators(
    UsePagination(),
    ApiQueryMany(),
    ApiOkResponseWrapped(model, true)
  )
}
