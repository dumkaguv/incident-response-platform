import { GqlExecutionContext } from '@nestjs/graphql'
import { OperationTypeNode } from 'graphql'
import type { ExecutionContext } from '@nestjs/common'
import type { GraphQLResolveInfo } from 'graphql'

export function isMutation(context: ExecutionContext): boolean {
  const info = GqlExecutionContext.create(context).getInfo<
    GraphQLResolveInfo | undefined
  >()

  return info?.operation.operation === OperationTypeNode.MUTATION
}
