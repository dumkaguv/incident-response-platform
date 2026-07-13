import type { ApiQueryOptions } from '@nestjs/swagger'

export const API_GLOBAL_PREFIX = 'api'

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

export const DEFAULT_GET_QUERY: ApiQueryOptions[] = [
  {
    name: 'page',
    type: 'integer',
    description: 'A page number within the paginated result set.',
    required: false,
    schema: {
      type: 'integer',
      default: DEFAULT_PAGE,
      minimum: DEFAULT_PAGE
    }
  },
  {
    name: 'pageSize',
    type: 'integer',
    description: `Number of results to return per page. Maximum: ${MAX_PAGE_SIZE}`,
    required: false,
    schema: {
      type: 'integer',
      default: DEFAULT_PAGE_SIZE,
      maximum: MAX_PAGE_SIZE,
      minimum: 1
    }
  },
  {
    name: 'ordering',
    type: 'string',
    description: 'Which field to use when ordering the results.',
    required: false
  },
  {
    name: 'search',
    type: 'string',
    description: 'A search term.',
    required: false
  }
] as const
