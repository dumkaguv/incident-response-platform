import { type ValueNode, GraphQLScalarType, Kind } from 'graphql'

import { BadUserInputError } from '@/common/utils'

function toIsoString(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new BadUserInputError(
      `DateTime expects an ISO-8601 string, received ${typeof value}`
    )
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new BadUserInputError(`DateTime received an unparsable value`)
  }

  return date.toISOString()
}

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description:
    'A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format.',
  serialize: toIsoString,
  parseValue: toIsoString,
  parseLiteral(node: ValueNode): string {
    if (node.kind !== Kind.STRING) {
      throw new BadUserInputError('DateTime expects a string literal')
    }

    return toIsoString(node.value)
  }
})
