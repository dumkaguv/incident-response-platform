/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { applyDecorators } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger'

import { BaseResponseDto, PaginatedResponseDto } from '@/common/dtos'

export function ApiOkResponseWrapped(model: any, paginated = false) {
  const wrapper = paginated ? PaginatedResponseDto : BaseResponseDto

  return applyDecorators(
    ApiExtraModels(model, wrapper),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(wrapper) },
          {
            properties: {
              data: paginated
                ? { type: 'array', items: { $ref: getSchemaPath(model) } }
                : { $ref: getSchemaPath(model) }
            }
          }
        ]
      }
    })
  )
}
