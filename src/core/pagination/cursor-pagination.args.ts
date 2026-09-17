import { ArgsType, Field, Int } from '@nestjs/graphql'

import { DEFAULT_FIRST, MAX_FIRST } from './pagination.constants'

@ArgsType()
export class CursorPaginationArgs {
  @Field(() => Int, {
    nullable: true,
    description: `Forward page size; defaults to ${DEFAULT_FIRST}, max ${MAX_FIRST}`
  })
  first?: number

  @Field(() => Int, {
    nullable: true,
    description: `Backward page size, max ${MAX_FIRST}`
  })
  last?: number

  @Field(() => String, {
    nullable: true,
    description:
      'Continue after pageInfo.endCursor with the same filter, search and orderBy'
  })
  after?: string

  @Field(() => String, {
    nullable: true,
    description:
      'Continue before pageInfo.startCursor with the same filter, search and orderBy'
  })
  before?: string
}
