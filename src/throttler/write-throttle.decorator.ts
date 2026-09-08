import { Throttle } from '@nestjs/throttler'

import { WRITE_TIERS } from './throttler.constants'

export function WriteThrottle(): MethodDecorator & ClassDecorator {
  return Throttle({
    burst: WRITE_TIERS.burst,
    sustained: WRITE_TIERS.sustained
  })
}
