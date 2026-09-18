import { type ValueNode, GraphQLScalarType, Kind } from 'graphql'

import { BadUserInputError, isRfc3339DateTime, toRfc3339 } from '@/common/utils'

function serialize(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const formatted = typeof value === 'string' ? toRfc3339(value) : null

  if (formatted === null) {
    throw new TypeError(
      `DateTime cannot serialize ${typeof value === 'string' ? JSON.stringify(value) : typeof value}`
    )
  }

  return formatted
}

function parse(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadUserInputError(
      `DateTime expects an RFC 3339 string, received ${typeof value}`
    )
  }

  const formatted = isRfc3339DateTime(value) ? toRfc3339(value) : null

  if (formatted === null) {
    throw new BadUserInputError(
      'DateTime expects an RFC 3339 date-time with an offset, such as 2026-09-18T09:07:20.120265Z'
    )
  }

  return formatted
}

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description:
    'An RFC 3339 date-time with an offset, such as 2026-09-18T09:07:20.120265Z; fractional seconds are kept exactly as stored.',
  serialize,
  parseValue: parse,
  parseLiteral(node: ValueNode): string {
    if (node.kind !== Kind.STRING) {
      throw new BadUserInputError('DateTime expects a string literal')
    }

    return parse(node.value)
  }
})
