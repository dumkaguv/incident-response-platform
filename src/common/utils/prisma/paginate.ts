/* eslint-disable @typescript-eslint/ban-ts-comment */
// Prisma model delegates are not scaffolded in this repository yet.
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable unused-imports/no-unused-vars */

import { Prisma, PrismaClient } from '@prisma/client'

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from '@/common/constants'

type PrismaModelDelegate = {
  findMany: (args?: unknown) => unknown
  count: (args?: unknown) => unknown
}

type PrismaClientKey = Extract<keyof PrismaClient, string>

type PrismaModelKey = {
  [Key in PrismaClientKey]: PrismaClient[Key] extends PrismaModelDelegate
    ? Key
    : never
}[PrismaClientKey]

type ModelFindManyArgs<Key extends PrismaModelKey> = Prisma.Args<
  PrismaClient[Key],
  'findMany'
>

type ModelWhere<Key extends PrismaModelKey> = ModelFindManyArgs<Key>['where']
type ModelOrderBy<Key extends PrismaModelKey> =
  ModelFindManyArgs<Key>['orderBy']

type OrderByInput<Key extends PrismaModelKey> =
  NonNullable<ModelOrderBy<Key>> extends (infer Item)[]
    ? Item
    : NonNullable<ModelOrderBy<Key>>

type SelectionArgs<Select, Include> = ([Select] extends [undefined | null]
  ? {}
  : { select: Exclude<Select, undefined | null> }) &
  ([Include] extends [undefined | null]
    ? {}
    : { include: Exclude<Include, undefined | null> })

type ModelRecord<Key extends PrismaModelKey, Select, Include> = Prisma.Result<
  PrismaClient[Key],
  Prisma.SelectSubset<SelectionArgs<Select, Include>, ModelFindManyArgs<Key>>,
  'findMany'
>[number]

type PaginateBaseParams<Key extends PrismaModelKey, Select, Include> = {
  prisma: PrismaClient
  model: Key
  page?: number
  pageSize?: number

  ordering?: string
  search?: string
  select?: Select
  include?: Include
  where?: ModelFindManyArgs<Key>['where']
}

type ComputedFn<Key extends PrismaModelKey, Select, Include, Context> = (
  record: ModelRecord<Key, Select, Include>,
  helpers: { prisma: PrismaClient; context: Context }
) => unknown | Promise<unknown>

type ComputedMap<Key extends PrismaModelKey, Select, Include, Context> = Record<
  string,
  ComputedFn<Key, Select, Include, Context>
>

type ComputedValues<C extends Record<string, (...args: any[]) => any>> = {
  [K in keyof C]: Awaited<ReturnType<C[K]>>
}

type ComputedBatchFn<Key extends PrismaModelKey, Select, Include, Context> = (
  records: ModelRecord<Key, Select, Include>[],
  helpers: { prisma: PrismaClient; context: Context }
) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>

type ComputedBatchValues<CB> = CB extends (...args: any[]) => Promise<infer R>
  ? R extends (infer Item)[]
    ? Item
    : never
  : CB extends (...args: any[]) => infer R
    ? R extends (infer Item)[]
      ? Item
      : never
    : never

type PaginateParams<
  Key extends PrismaModelKey,
  Select,
  Include,
  Context
> = Context extends undefined
  ? PaginateBaseParams<Key, Select, Include> & {
      computed?: ComputedMap<Key, Select, Include, undefined>
      computedBatch?: ComputedBatchFn<Key, Select, Include, undefined>
      context?: undefined
    }
  : PaginateBaseParams<Key, Select, Include> & {
      computed?: ComputedMap<Key, Select, Include, Context>
      computedBatch?: ComputedBatchFn<Key, Select, Include, Context>
      context: Context
    }

type ModelClient<
  Key extends PrismaModelKey,
  Select extends ModelFindManyArgs<Key>['select'],
  Include extends ModelFindManyArgs<Key>['include']
> = {
  findMany(
    args: Prisma.SelectSubset<
      ModelFindManyArgs<Key> & {
        skip?: number
        take?: number
        orderBy?: Record<string, 'asc' | 'desc'>
      },
      ModelFindManyArgs<Key>
    >
  ): Prisma.PrismaPromise<ModelRecord<Key, Select, Include>[]>
  count(args: { where?: ModelWhere<Key> }): Prisma.PrismaPromise<number>
}

export async function paginate<
  Key extends PrismaModelKey,
  Select extends ModelFindManyArgs<Key>['select'] = undefined,
  Include extends ModelFindManyArgs<Key>['include'] = undefined,
  Context = undefined
>(
  params: PaginateParams<Key, Select, Include, Context> & {
    computed?: undefined
    computedBatch?: undefined
  }
): Promise<{
  data: ModelRecord<Key, Select, Include>[]
  total: number
}>

export async function paginate<
  Key extends PrismaModelKey,
  Select extends ModelFindManyArgs<Key>['select'] = undefined,
  Include extends ModelFindManyArgs<Key>['include'] = undefined,
  Context = undefined,
  C extends ComputedMap<Key, Select, Include, Context> = ComputedMap<
    Key,
    Select,
    Include,
    Context
  >
>(
  params: PaginateParams<Key, Select, Include, Context> & { computed: C }
): Promise<{
  data: (ModelRecord<Key, Select, Include> & ComputedValues<C>)[]
  total: number
}>

export async function paginate<
  Key extends PrismaModelKey,
  Select extends ModelFindManyArgs<Key>['select'] = undefined,
  Include extends ModelFindManyArgs<Key>['include'] = undefined,
  Context = undefined,
  CB extends ComputedBatchFn<Key, Select, Include, Context> = ComputedBatchFn<
    Key,
    Select,
    Include,
    Context
  >
>(
  params: PaginateParams<Key, Select, Include, Context> & {
    computed?: undefined
    computedBatch: CB
  }
): Promise<{
  data: (ModelRecord<Key, Select, Include> & ComputedBatchValues<CB>)[]
  total: number
}>

export async function paginate<
  Key extends PrismaModelKey,
  Select extends ModelFindManyArgs<Key>['select'] = undefined,
  Include extends ModelFindManyArgs<Key>['include'] = undefined,
  Context = undefined,
  C extends ComputedMap<Key, Select, Include, Context> = ComputedMap<
    Key,
    Select,
    Include,
    Context
  >,
  CB extends ComputedBatchFn<Key, Select, Include, Context> = ComputedBatchFn<
    Key,
    Select,
    Include,
    Context
  >
>(
  params: PaginateParams<Key, Select, Include, Context> & {
    computed: C
    computedBatch: CB
  }
): Promise<{
  data: (ModelRecord<Key, Select, Include> &
    ComputedValues<C> &
    ComputedBatchValues<CB>)[]
  total: number
}>

export async function paginate<
  Key extends PrismaModelKey,
  Select extends ModelFindManyArgs<Key>['select'] = undefined,
  Include extends ModelFindManyArgs<Key>['include'] = undefined,
  Context = undefined
>({
  prisma,
  model,
  page,
  pageSize,
  ordering,
  search,
  select,
  include,
  where: whereParam,
  computed,
  computedBatch,
  context
}: PaginateParams<Key, Select, Include, Context>): Promise<{
  data: any[]
  total: number
}> {
  const safePageSize = Math.min(
    Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  )
  const safePage = Math.max(1, page ?? DEFAULT_PAGE)

  const skip = (safePage - 1) * safePageSize
  const take = safePageSize

  let orderBy: Record<string, 'asc' | 'desc'> | undefined

  if (ordering) {
    const direction = ordering.startsWith('-') ? 'desc' : 'asc'
    const field = ordering.replace(/^-/, '')

    orderBy = { [field]: direction }
  }

  const modelClient = prisma[model] as unknown as ModelClient<
    Key,
    Select,
    Include
  >

  const capitalizedModel =
    String(model)[0].toUpperCase() + String(model).slice(1).toLowerCase()

  const prismaModel = Prisma.dmmf.datamodel.models.find(
    (m) => m.name === capitalizedModel
  )

  let where: ModelWhere<Key> | undefined = whereParam as any

  if (search && prismaModel) {
    const stringFields = prismaModel.fields
      .filter(({ type }) => type === 'String')
      .map(({ name }) => ({ field: name }))

    if (stringFields.length > 0) {
      const searchWhere = {
        OR: stringFields.map(({ field }) => ({
          [field]: { contains: search, mode: Prisma.QueryMode.insensitive }
        }))
      } as ModelWhere<Key>

      where = whereParam
        ? ({ AND: [whereParam, searchWhere] } as ModelWhere<Key>)
        : searchWhere
    }
  }

  const [data, total] = await Promise.all([
    modelClient.findMany({
      skip,
      take,
      orderBy,
      where,
      select,
      include
    } as any),
    modelClient.count({ where })
  ])

  if (!computed && !computedBatch) {
    return { data, total }
  }

  const helpers = { prisma, context } as {
    prisma: PrismaClient
    context: Context
  }

  let resultData = data as Record<string, unknown>[]

  if (computedBatch) {
    const batchValues = await computedBatch(data as any, helpers as any)

    if (!Array.isArray(batchValues)) {
      throw new Error('computedBatch must return an array')
    }

    if (batchValues.length !== data.length) {
      throw new Error(
        'computedBatch result length must match the number of records'
      )
    }

    resultData = data.map((record, index) => ({
      ...(record as Record<string, unknown>),
      ...(batchValues[index] ?? {})
    }))
  }

  if (!computed) {
    return { data: resultData, total }
  }

  const resultDataWithComputed = await Promise.all(
    resultData.map(async (record) => {
      const computedValues: Record<string, unknown> = {}

      for (const [key, fn] of Object.entries(computed)) {
        computedValues[key] = await fn(record as any, helpers as any)
      }

      return { ...record, ...computedValues }
    })
  )

  return { data: resultDataWithComputed, total }
}
