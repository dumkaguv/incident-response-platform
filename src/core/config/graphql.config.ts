import { registerAs } from '@nestjs/config'

import { env } from './env.schema'
import { isDev } from './is-dev'

export const graphqlConfig = registerAs('graphql', () => ({
  explorer: env().GRAPHIQL ?? isDev()
}))
