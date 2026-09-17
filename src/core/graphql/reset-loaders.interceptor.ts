import {
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  Injectable
} from '@nestjs/common'
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql'
import { OperationTypeNode } from 'graphql'
import { type Observable, finalize } from 'rxjs'
import type { GraphQLResolveInfo } from 'graphql'

import type { GqlContext } from './graphql-context'

function isRootMutationField(info: GraphQLResolveInfo | undefined): boolean {
  return (
    info?.operation.operation === OperationTypeNode.MUTATION &&
    info.path.prev === undefined
  )
}

@Injectable()
export class ResetLoadersInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    if (context.getType<GqlContextType>() !== 'graphql') {
      return next.handle()
    }

    const gql = GqlExecutionContext.create(context)

    if (!isRootMutationField(gql.getInfo<GraphQLResolveInfo | undefined>())) {
      return next.handle()
    }

    const { loaders } = gql.getContext<GqlContext>()

    return next.handle().pipe(
      finalize(() => {
        loaders.clear()
      })
    )
  }
}
