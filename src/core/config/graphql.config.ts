import { registerAs } from '@nestjs/config'

import { env } from './env.schema'
import { isDev } from './is-dev'

export const graphqlConfig = registerAs('graphql', () => {
  const debug = isDev()

  return { explorer: env().GRAPHIQL ?? debug, debug }
})
