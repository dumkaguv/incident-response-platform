import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants'

export class BaseResponseDto<TData> {
  @ApiProperty({ example: 'true', required: true, nullable: false })
  success: boolean

  @ApiProperty({ example: 'Success', required: false, nullable: true })
  message?: string

  @ApiProperty({ isArray: false, required: false, nullable: true })
  @Type(() => Object)
  data?: TData
}

export class PaginatedResponseDto<TData> extends BaseResponseDto<TData> {
  @ApiProperty({ example: 100 })
  total: number

  @ApiProperty({
    example: 2,
    default: DEFAULT_PAGE,
    minimum: DEFAULT_PAGE
  })
  page: number

  @ApiProperty({
    example: DEFAULT_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    maximum: MAX_PAGE_SIZE,
    minimum: 1
  })
  pageSize: number

  @ApiProperty({ example: 10 })
  totalPages: number

  @ApiProperty({ example: 2, nullable: true, required: false })
  nextPage?: number

  @ApiProperty({ example: 1, nullable: true, required: false })
  prevPage?: number
}
