import { Plugin } from '@nestjs/apollo'
import { HttpStatus } from '@nestjs/common'
import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
  GraphQLResponse
} from '@apollo/server'

import { TooManyRequestsError } from '@/common/utils'

function wasRateLimited(response: GraphQLResponse): boolean {
  if (response.body.kind !== 'single') {
    return false
  }

  return (
    response.body.singleResult.errors?.some(
      (error) => error.extensions?.code === TooManyRequestsError.code
    ) ?? false
  )
}

@Plugin()
export class ThrottleStatusPlugin implements ApolloServerPlugin {
  public requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    return Promise.resolve({
      willSendResponse({ response }) {
        if (wasRateLimited(response)) {
          response.http.status = HttpStatus.TOO_MANY_REQUESTS
        }

        return Promise.resolve()
      }
    })
  }
}
