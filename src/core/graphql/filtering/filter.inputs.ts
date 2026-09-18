import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  registerEnumType
} from '@nestjs/graphql'
import type { Type } from '@nestjs/common'
import type { GraphQLScalarType } from 'graphql'

import { DateTimeScalar } from '@/core/graphql/scalars/date-time.scalar'
import { operatorsFor } from '@/core/pagination/utils/query-filter'
import type { ScalarQueryField } from '@/core/pagination/utils/query-definition'

import { registerQueryEnum } from './enum-filter.factory'

const FilterIs = { NULL: 'NULL', NOT_NULL: 'NOT_NULL' } as const

registerEnumType(FilterIs, {
  name: 'FilterIs',
  description: 'Exact SQL null checks'
})

const OPERATOR_MEANING: Record<string, string> = {
  eq: 'Equal to this value',
  ne: 'Not equal to this value',
  in: 'Equal to any value in the list',
  nin: 'Equal to none of the values in the list',
  is: 'Whether the field holds a value at all',
  gt: 'Greater than this value',
  gte: 'Greater than or equal to this value',
  lt: 'Less than this value',
  lte: 'Less than or equal to this value',
  contains: 'Holds this text anywhere, ignoring case',
  startsWith: 'Begins with this text, ignoring case',
  endsWith: 'Ends with this text, ignoring case'
}

const inputs = new Map<string, Type<unknown>>()

type ScalarRef =
  | StringConstructor
  | BooleanConstructor
  | DateConstructor
  | GraphQLScalarType
  | Record<string, string>

function scalarRef(field: ScalarQueryField): ScalarRef {
  switch (field.type) {
    case 'string':
      return String

    case 'id':
      return ID

    case 'int':
      return Int

    case 'float':
      return Float

    case 'boolean':
      return Boolean

    case 'date':
      return DateTimeScalar

    case 'enum': {
      if (!field.enum) {
        throw new Error('Missing enum definition')
      }

      registerQueryEnum(field.enum.values, field.enum.name)

      return field.enum.values
    }
  }
}

export function scalarFilterInputFor(field: ScalarQueryField): Type<unknown> {
  const names = {
    string: 'String',
    id: 'Id',
    int: 'Int',
    float: 'Float',
    boolean: 'Boolean',
    date: 'DateTime',
    enum: field.enum?.name
  }
  const name = `${names[field.type]}Filter`
  const valueType = scalarRef(field)
  const existing = inputs.get(name)

  if (existing) {
    return existing
  }

  @InputType(name)
  class ScalarFilterInput {}

  for (const operator of operatorsFor(field)) {
    const list = operator === 'in' || operator === 'nin'
    const ref = operator === 'is' ? FilterIs : valueType
    const description = OPERATOR_MEANING[operator] ?? operator

    if (list) {
      Field(() => [ref], { nullable: true, description })(
        ScalarFilterInput.prototype,
        operator
      )
    } else {
      Field(() => ref, { nullable: true, description })(
        ScalarFilterInput.prototype,
        operator
      )
    }
  }

  inputs.set(name, ScalarFilterInput)

  return ScalarFilterInput
}
