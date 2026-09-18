import { msg } from '@lingui/core/macro'

import { BadUserInputError } from '@/common/utils'

export function assertStatusRange(
  expectedStatusMin: number | undefined,
  expectedStatusMax: number | undefined
): void {
  const bothKnown =
    expectedStatusMin !== undefined && expectedStatusMax !== undefined

  if (bothKnown && expectedStatusMin > expectedStatusMax) {
    throw new BadUserInputError(
      msg`expectedStatusMin must not exceed expectedStatusMax`
    )
  }
}
