import {
  Args,
  ArgsType,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  Query,
  Resolver
} from '@nestjs/graphql'
import { Test } from '@nestjs/testing'
import { type GraphQLSchema, parse, printSchema, validate } from 'graphql'
import { beforeAll, describe, expect, it } from 'vitest'

import { QueryArgsFor } from '@/graphql/filtering/query-args.factory'

import { fixtureQuery } from './fixtures/query-definition'

@ArgsType()
class FixtureArgs extends QueryArgsFor(fixtureQuery) {}

@Resolver()
class FixtureResolver {
  @Query(() => String)
  public inspectFixture(@Args() args: FixtureArgs): string {
    return JSON.stringify(args.toSpec())
  }
}

describe('generated query schema', () => {
  let schema: GraphQLSchema

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule]
    }).compile()

    try {
      schema = await module.get(GraphQLSchemaFactory).create([FixtureResolver])
    } finally {
      await module.close()
    }
  })

  it('accepts typed composites, nested relations, collections and orderBy', () => {
    const query = parse(`query {
      inspectFixture(
        first: 2
        filter: {
          and: [
            { location: { city: { startsWith: "Pa" } } }
            { owner: { organization: { name: { eq: "Acme" } } } }
            { comments: { some: { body: { contains: "hello" }, flagged: { eq: true } } } }
            { not: { priority: { in: [LOW] } } }
          ]
        }
        orderBy: [{ owner: { organization: { name: AscNullsLast } } }, { rank: DESC }]
        search: "database"
      )
    }`)

    expect(validate(schema, query)).toEqual([])
    expect(printSchema(schema)).toContain('before: String')
    expect(printSchema(schema)).toContain('last: Int')
  })

  it.each([
    'page: 2',
    'pageSize: 10',
    'filter: { secret: { eq: "x" } }',
    'filter: { rank: { contains: "x" } }',
    'filter: { priority: { eq: UNKNOWN } }',
    'orderBy: [{ comments: { body: ASC } }]',
    'orderBy: [{ owner: { secret: ASC } }]'
  ])('does not expose unconfigured fields or invalid operators: %s', (args) => {
    expect(
      validate(schema, parse(`query { inspectFixture(${args}) }`))
    ).not.toHaveLength(0)
  })
})
