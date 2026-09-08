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

import { operatorsFor } from '@/core/pagination/utils/query-filter'
import type { ScalarQueryField } from '@/core/pagination/utils/query-definition'

import { DateTimeScalar } from '../scalars/date-time.scalar'

import { registerQueryEnum } from './enum-filter.factory'

const FilterIs = { NULL: 'NULL', NOT_NULL: 'NOT_NULL' } as const

registerEnumType(FilterIs, {
  name: 'FilterIs',
  description: 'Exact SQL null checks'
})

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
    const description = ['contains', 'startsWith', 'endsWith'].includes(
      operator
    )
      ? `${operator} (case-insensitive)`
      : operator

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
