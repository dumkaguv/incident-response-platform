import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType('PageInfo', {
  description: 'Relay-style pagination metadata'
})
export class PageInfoObject {
  @Field(() => Boolean, {
    description: 'Whether more records exist after endCursor'
  })
  hasNextPage: boolean

  @Field(() => Boolean, {
    description:
      'Whether more records exist before startCursor; inferred from the cursor on forward pages'
  })
  hasPreviousPage: boolean

  @Field(() => String, {
    nullable: true,
    description: 'Cursor of the first node on this page'
  })
  startCursor: string | null

  @Field(() => String, {
    nullable: true,
    description:
      'Cursor of the last node on this page; pass as `after` to get the next page'
  })
  endCursor: string | null
}
