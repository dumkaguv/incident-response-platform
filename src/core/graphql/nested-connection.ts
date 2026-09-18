import {
  Args,
  ArgsType,
  Context,
  Field,
  Int,
  Parent,
  ResolveField,
  Resolver
} from '@nestjs/graphql'
import type { Type } from '@nestjs/common'

import { Connection } from '@/core/pagination/connection'
import {
  DEFAULT_NESTED_FIRST,
  MAX_FIRST
} from '@/core/pagination/pagination.constants'
import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import { isProvided } from '@/core/pagination/utils/query-definition'
import { PrismaService } from '@/core/prisma/prisma.service'
import {
  countNestedRows,
  selectNestedPage
} from '@/core/prisma/utils/nested-page'
import type { QueryDefinition } from '@/core/pagination/utils/query-definition'
import type { ModelName } from '@/core/prisma/utils/query-table'

import { getLoader } from './dataloader'
import { orderInputFor } from './filtering/query-args.factory'
import type { GqlContext } from './graphql-context'

export type NestedConnectionArgs = {
  first?: number | null
  last?: number | null
  orderBy?: unknown
}

type Row = Record<string, unknown>

type IdTable = {
  where(
    build: (
      fields: Record<string, { in(values: string[]): unknown }>
    ) => unknown
  ): { all(): Promise<Row[]> }
}

function nestedArgsFor(
  definition: QueryDefinition
): Type<NestedConnectionArgs> {
  const orderInput = orderInputFor(definition)

  @ArgsType()
  class GeneratedNestedArgs {
    @Field(() => Int, {
      nullable: true,
      description: `Rows per parent; defaults to ${DEFAULT_NESTED_FIRST}, max ${MAX_FIRST}`
    })
    public first?: number

    @Field(() => Int, {
      nullable: true,
      description: `Rows per parent counted from the far end, max ${MAX_FIRST}`
    })
    public last?: number

    public orderBy?: unknown
  }

  if (orderInput) {
    Field(() => [orderInput], {
      nullable: true,
      description: 'One scalar path per entry; array order defines precedence'
    })(GeneratedNestedArgs.prototype, 'orderBy')
  }

  return GeneratedNestedArgs
}

export function NestedConnection(options: {
  parent: Type<unknown>
  field: string
  connection: Type<unknown>
  definition: QueryDefinition
  model: ModelName
  foreignKey: string
  description: string
}): Type<unknown> {
  const { field, foreignKey, model } = options
  const definition: QueryDefinition = {
    ...options.definition,
    name: `${options.parent.name}.${field}`
  }
  const NestedArgs = nestedArgsFor(options.definition)

  @Resolver(() => options.parent)
  class GeneratedNestedResolver {
    constructor(private readonly prisma: PrismaService) {}

    @ResolveField(options.field, () => options.connection, {
      description: `${options.description}; first and last size the page, a later page is read through the root query`
    })
    public page(
      @Parent() parent: { id: string },
      @Args({ type: () => NestedArgs }) args: InstanceType<typeof NestedArgs>,
      @Context() context: GqlContext
    ): Promise<Connection<unknown>> {
      const spec = normalizeQuery(definition, {
        first:
          args.first ??
          (isProvided(args.last) ? undefined : DEFAULT_NESTED_FIRST),
        last: args.last,
        orderBy: args.orderBy
      })
      const db = this.prisma.db
      const totals = getLoader(
        context,
        `nested-total:${model}:${field}`,
        async (parentIds: readonly string[]) => {
          const counted = await countNestedRows(db, {
            model,
            foreignKey,
            parentIds
          })

          return parentIds.map((parentId) => counted.get(parentId) ?? 0)
        }
      )
      const pages = getLoader(
        context,
        `nested:${model}:${field}:${spec.fingerprint}:${spec.pagination.direction}:${spec.pagination.limit}`,
        async (parentIds: readonly string[]) => {
          const page = await selectNestedPage(db, {
            model,
            foreignKey,
            parentIds,
            sort: spec.sort,
            take: spec.pagination.limit + 1,
            backward: spec.pagination.direction === 'backward'
          })
          const flat = [...page.values()].flat()
          const table = db.orm.public[model] as unknown as IdTable
          const rows = flat.length
            ? await table.where((fields) => fields.id.in(flat)).all()
            : []
          const byId = new Map(rows.map((row) => [String(row.id), row]))

          return parentIds.map((parentId) => {
            const ordered = (page.get(parentId) ?? [])
              .map((id) => byId.get(id))
              .filter((row) => row !== undefined)

            return new Connection(ordered, spec, () => totals.load(parentId))
          })
        }
      )

      return pages.load(parent.id)
    }
  }

  Object.defineProperty(GeneratedNestedResolver, 'name', {
    value: `${options.parent.name}${field[0].toUpperCase()}${field.slice(1)}Resolver`
  })

  return GeneratedNestedResolver
}
