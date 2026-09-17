import { registerAs } from '@nestjs/config'

import { env } from './env.schema'

export const appConfig = registerAs('app', () => {
  const { NODE_ENV, PORT, TRUST_PROXY } = env()

  return { nodeEnv: NODE_ENV, port: PORT, trustProxy: TRUST_PROXY }
})
