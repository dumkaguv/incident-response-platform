import { ArgsType, Field, InputType, registerEnumType } from '@nestjs/graphql'
import { IsOptional, MaxLength } from 'class-validator'
import type { Type } from '@nestjs/common'

import { CursorPaginationArgs } from '@/core/pagination/cursor-pagination.args'
import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import {
  type QueryDefinition,
  type QueryFields,
  validateQueryDefinition
} from '@/core/pagination/utils/query-definition'
import { ORDER_DIRECTIONS } from '@/core/pagination/utils/query-order'
import type { QuerySpec } from '@/core/pagination/utils/query-spec'

import { scalarFilterInputFor } from './filter.inputs'

registerEnumType(ORDER_DIRECTIONS, {
  name: 'OrderByDirection',
  description: 'Sort direction and null placement'
})

export type QueryArgs = {
  filter?: unknown
  orderBy?: unknown
  search?: string
  toSpec(): QuerySpec
}

export function QueryArgsFor(definition: QueryDefinition): Type<QueryArgs> {
  validateQueryDefinition(definition)
  const filterInput = buildFilterInput(definition.name, definition.fields)
  const orderInput = buildOrderInput(definition.name, definition.fields)

  @ArgsType()
  class GeneratedQueryArgs extends CursorPaginationArgs {
    @IsOptional()
    @Field(() => filterInput, {
      nullable: true,
      description: 'Typed filters with nested and/or/not groups'
    })
    public filter?: unknown

    @IsOptional()
    public orderBy?: unknown

    @IsOptional()
    @MaxLength(200)
    public search?: string

    public toSpec(): QuerySpec {
      return normalizeQuery(definition, this)
    }
  }

  if (orderInput) {
    Field(() => [orderInput], {
      nullable: true,
      description: 'One scalar path per entry; array order defines precedence'
    })(GeneratedQueryArgs.prototype, 'orderBy')
  }

  if (definition.searchable?.length) {
    Field(() => String, {
      nullable: true,
      description: `Case-insensitive search across: ${definition.searchable.join(', ')}`
    })(GeneratedQueryArgs.prototype, 'search')
  }

  return GeneratedQueryArgs
}

function buildFilterInput(name: string, fields: QueryFields): Type<unknown> {
  @InputType(`${name}Filter`)
  class FilterInput {}

  for (const operator of ['and', 'or']) {
    Field(() => [FilterInput], { nullable: true })(
      FilterInput.prototype,
      operator
    )
  }
  Field(() => FilterInput, { nullable: true })(FilterInput.prototype, 'not')

  for (const [key, field] of Object.entries(fields)) {
    let input: Type<unknown>

    if (field.type === 'composite' || field.type === 'relation') {
      const nested = buildFilterInput(`${name}_${key}`, field.fields)

      input = nested
      if (field.type === 'relation' && field.many) {
        @InputType(`${name}_${key}RelationFilter`)
        class CollectionFilterInput {}

        for (const quantifier of ['some', 'every', 'none']) {
          Field(() => nested, { nullable: true })(
            CollectionFilterInput.prototype,
            quantifier
          )
        }
        input = CollectionFilterInput
      }
    } else {
      if (!field.filterable) {
        continue
      }

      input = scalarFilterInputFor(field)
    }

    Field(() => input, { nullable: true })(FilterInput.prototype, key)
  }

  return FilterInput
}

function buildOrderInput(
  name: string,
  fields: QueryFields
): Type<unknown> | null {
  @InputType(`${name}OrderBy`)
  class OrderInput {}

  let count = 0

  for (const [key, field] of Object.entries(fields)) {
    if (field.type === 'relation' && field.many) {
      continue
    }

    if (field.type === 'composite' || field.type === 'relation') {
      const nested = buildOrderInput(`${name}_${key}`, field.fields)

      if (!nested) {
        continue
      }

      Field(() => nested, { nullable: true })(OrderInput.prototype, key)
    } else {
      if (!field.sortable) {
        continue
      }

      Field(() => ORDER_DIRECTIONS, { nullable: true })(
        OrderInput.prototype,
        key
      )
    }

    count++
  }

  return count ? OrderInput : null
}
