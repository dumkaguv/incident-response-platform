import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from '@/common/constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FindAllQueryDto<T = any> {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  ordering?: `${Extract<keyof T, string>}` | `-${Extract<keyof T, string>}`
}
