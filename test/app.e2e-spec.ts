import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getIntrospectionQuery } from 'graphql'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '@/core/prisma/prisma.service'
import { IncidentRepositoryInterface } from '@/modules/incident/repositories/incident.repository.interface'

import { AppModule } from '../src/app/app.module'

type Server = Parameters<typeof request>[0]

describe('GraphQL API (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  function gql(query: string) {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .send({ query })
  }

  it('returns nodes, pageInfo and lazy totalCount with filter and orderBy', async () => {
    const response = await gql(`
      query {
        incidents(
          first: 5
          filter: { status: { in: [OPEN, INVESTIGATING] } }
          orderBy: [{ createdAt: DESC }]
        ) {
          nodes {
            id
            title
            status
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `).expect(200)

    const incidents = response.body.data.incidents

    expect(incidents.totalCount).toBeGreaterThan(0)
    expect(incidents.nodes.length).toBeGreaterThan(0)
    expect(incidents.pageInfo.hasPreviousPage).toBe(false)
    expect(incidents.pageInfo.endCursor).toEqual(expect.any(String))

    for (const node of incidents.nodes) {
      expect(['OPEN', 'INVESTIGATING']).toContain(node.status)
    }
  })

  it('walks pages via endCursor without overlaps', async () => {
    const firstPage = await gql(`
      query {
        incidents(first: 3) {
          nodes { id }
          pageInfo { hasNextPage endCursor }
        }
      }
    `).expect(200)

    const first = firstPage.body.data.incidents

    expect(first.pageInfo.hasNextPage).toBe(true)

    const secondPage = await gql(`
      query {
        incidents(first: 3, after: "${first.pageInfo.endCursor}") {
          nodes { id }
          pageInfo { hasPreviousPage }
        }
      }
    `).expect(200)

    const second = secondPage.body.data.incidents
    const firstIds = new Set(first.nodes.map((node: { id: string }) => node.id))

    expect(second.pageInfo.hasPreviousPage).toBe(true)
    expect(second.nodes.length).toBeGreaterThan(0)

    for (const node of second.nodes) {
      expect(firstIds.has(node.id)).toBe(false)
    }
  })

  it('rejects a malformed cursor with BAD_USER_INPUT', async () => {
    const response = await gql(`
      query {
        incidents(after: "not-a-cursor") {
          nodes { id }
        }
      }
    `)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
  })

  it('combines recursive filters, nested-style orderBy, edges and backward pagination', async () => {
    const argumentsText = `
      filter: { or: [{ status: { eq: OPEN } }, { severity: { eq: HIGH } }] }
      orderBy: [{ resolvedAt: AscNullsLast }, { severity: DESC }]
    `
    const firstResponse = await gql(`query {
      incidents(first: 2, ${argumentsText}) {
        edges { node { id } cursor }
        pageInfo { endCursor }
        totalCount
      }
    }`).expect(200)
    const first = firstResponse.body.data.incidents
    const secondResponse = await gql(`query {
      incidents(first: 2, after: "${first.pageInfo.endCursor}", ${argumentsText}) {
        nodes { id }
        pageInfo { startCursor }
        totalCount
      }
    }`).expect(200)
    const second = secondResponse.body.data.incidents
    const previousResponse = await gql(`query {
      incidents(last: 2, before: "${second.pageInfo.startCursor}", ${argumentsText}) {
        nodes { id }
      }
    }`).expect(200)

    expect(first.edges).toHaveLength(2)
    expect(first.edges[1].cursor).toBe(first.pageInfo.endCursor)
    expect(second.totalCount).toBe(first.totalCount)
    expect(previousResponse.body.data.incidents.nodes).toEqual(
      first.edges.map((edge: { node: unknown }) => edge.node)
    )
    const changed = await gql(`query {
      incidents(first: 2, after: "${first.pageInfo.endCursor}", orderBy: [{ title: ASC }]) { nodes { id } }
    }`)

    expect(changed.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
  })

  it('rejects first above the limit with BAD_USER_INPUT', async () => {
    const response = await gql(`
      query {
        incidents(first: 1000) {
          totalCount
        }
      }
    `)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
  })

  it('searches incidents case-insensitively', async () => {
    const response = await gql(`
      query {
        incidents(search: "DATABASE") {
          nodes {
            title
            description
          }
        }
      }
    `).expect(200)

    const nodes = response.body.data.incidents.nodes

    expect(nodes.length).toBeGreaterThan(0)

    for (const node of nodes) {
      const haystack = `${node.title} ${node.description ?? ''}`.toLowerCase()

      expect(haystack).toContain('database')
    }
  })

  it('returns NOT_FOUND for a missing incident', async () => {
    const response = await gql(`
      query {
        incident(id: "00000000-0000-0000-0000-000000000000") {
          id
        }
      }
    `)

    expect(response.body.errors[0].extensions.code).toBe('NOT_FOUND')
  })

  it('creates, partially updates, resolves and deletes an incident', async () => {
    const created = await gql(`mutation {
      createIncident(input: { title: "Mutation lifecycle test", severity: LOW }) {
        id title status severity
      }
    }`).expect(200)
    const incident = created.body.data.createIncident

    expect(incident.status).toBe('OPEN')

    try {
      const invalid = await gql(`mutation {
        updateIncident(id: "${incident.id}", input: { title: "x" }) { id }
      }`)

      expect(invalid.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
      const updated = await gql(`mutation {
        updateIncident(id: "${incident.id}", input: { severity: HIGH, description: null }) {
          id title severity description
        }
      }`).expect(200)

      expect(updated.body.data.updateIncident).toEqual({
        id: incident.id,
        title: incident.title,
        severity: 'HIGH',
        description: null
      })
      const resolved = await gql(`mutation {
        resolveIncident(id: "${incident.id}") { status resolvedAt }
      }`).expect(200)

      expect(resolved.body.data.resolveIncident).toEqual({
        status: 'RESOLVED',
        resolvedAt: expect.any(String)
      })
      const conflict = await gql(`mutation {
        resolveIncident(id: "${incident.id}") { id }
      }`)

      expect(conflict.body.errors[0].extensions.code).toBe('CONFLICT')
      const deleted = await gql(`mutation {
        deleteIncident(id: "${incident.id}") { id }
      }`).expect(200)

      expect(deleted.body.data.deleteIncident.id).toBe(incident.id)
    } finally {
      await app
        .get(PrismaService)
        .db.orm.public.Incident.where((fields) => fields.id.eq(incident.id))
        .delete()
    }
  })

  it('walks incident -> team -> team.incidents on one batched query each', async () => {
    const repository = app.get(IncidentRepositoryInterface)
    const findByTeamIds = repository.findByTeamIds.bind(repository)
    let batches = 0

    repository.findByTeamIds = (ids) => {
      batches += 1

      return findByTeamIds(ids)
    }

    try {
      const response = await gql(`
        query {
          incidents(first: 10) {
            nodes {
              id
              teamId
              team {
                name
                incidents {
                  id
                  teamId
                }
              }
            }
          }
        }
      `).expect(200)

      const nodes = response.body.data.incidents.nodes
      const withTeam = nodes.filter((node: { team: unknown }) => node.team)

      expect(withTeam.length).toBeGreaterThan(1)
      expect(batches).toBe(1)

      for (const node of withTeam) {
        const nested = node.team.incidents

        expect(nested.length).toBeGreaterThan(0)
        expect(nested.map((each: { id: string }) => each.id)).toContain(node.id)

        for (const each of nested) {
          expect(each.teamId).toBe(node.teamId)
        }
      }
    } finally {
      repository.findByTeamIds = findByTeamIds
    }
  })

  it('walks incident -> team -> members on one batched query', async () => {
    const response = await gql(`
      query {
        incidents(first: 10) {
          nodes {
            teamId
            team {
              name
              members { name email role }
            }
          }
        }
      }
    `).expect(200)

    const withTeam = response.body.data.incidents.nodes.filter(
      (node: { team: unknown }) => node.team
    )

    expect(withTeam.length).toBeGreaterThan(1)

    for (const node of withTeam) {
      expect(node.team.members.length).toBeGreaterThan(0)

      for (const member of node.team.members) {
        expect(member.email).toContain('@')
        expect(['LEAD', 'RESPONDER', 'OBSERVER']).toContain(member.role)
      }
    }
  })

  it('admits the costliest legitimate page', async () => {
    const response = await gql(`
      query {
        incidents(first: 100) {
          nodes {
            id
            title
            team {
              name
              members { name email role }
              incidents { id title }
            }
          }
        }
      }
    `).expect(200)

    expect(response.body.errors).toBeUndefined()
  })

  it('rejects an over-deep query before it costs anything to price', async () => {
    const response = await gql(`
      query {
        incidents(first: 1) {
          nodes {
            team {
              incidents {
                team {
                  incidents {
                    team {
                      incidents {
                        team {
                          incidents {
                            team { members { email } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `).expect(400)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toMatch(
      /^Query depth \d+ exceeds the limit of \d+$/
    )
  })

  it('lets the introspection query through the limits', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({ query: getIntrospectionQuery({ descriptions: true }) })
      .expect(200)

    expect(response.body.errors).toBeUndefined()
    expect(response.body.data.__schema.types.length).toBeGreaterThan(10)
  })

  it('rejects a cyclic query that outgrows the complexity budget', async () => {
    const response = await gql(`
      query {
        incidents(first: 10) {
          nodes {
            team {
              incidents {
                team {
                  incidents {
                    team { incidents { id } }
                  }
                }
              }
            }
          }
        }
      }
    `).expect(400)

    expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT')
    expect(response.body.errors[0].message).toMatch(
      /^Query complexity \d+ exceeds the limit of \d+$/
    )
  })

  it.each([
    'updateIncident(id: "00000000-0000-0000-0000-000000000000", input: { severity: HIGH })',
    'deleteIncident(id: "00000000-0000-0000-0000-000000000000")'
  ])('maps missing-record Prisma errors to NOT_FOUND: %s', async (mutation) => {
    const response = await gql(`mutation { ${mutation} { id } }`)

    expect(response.body.errors[0].extensions.code).toBe('NOT_FOUND')
  })
})
