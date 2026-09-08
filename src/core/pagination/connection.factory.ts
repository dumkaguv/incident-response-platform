import { Field, Int, ObjectType } from '@nestjs/graphql'
import type { Type } from '@nestjs/common'

import { Connection } from './connection'
import { PageInfoObject } from './page-info.model'

export function Connected<T>(classRef: Type<T>): Type<Connection<T>> {
  @ObjectType(`${classRef.name.replace(/Object$/, '')}Edge`)
  class EdgeHost {
    @Field(() => classRef)
    public node: T

    @Field(() => String)
    public cursor: string
  }

  @ObjectType({ isAbstract: true })
  class ConnectionHost {
    @Field(() => [EdgeHost], {
      description: 'Records with their keyset cursors'
    })
    public edges: EdgeHost[]

    @Field(() => [classRef], { description: 'Records of the current page' })
    public nodes: T[]

    @Field(() => PageInfoObject, {
      description: 'Cursors and page availability'
    })
    public pageInfo: PageInfoObject

    @Field(() => Int, {
      description: 'Total matching records; computed only when selected'
    })
    public totalCount: number
  }

  return ConnectionHost as unknown as Type<Connection<T>>
}
