# incident-response-platform

A synthetic uptime monitor: a `Monitor` describes an HTTP resource, a probe
records a `MonitorCheck`, and the history is read back over GraphQL. The
repository name predates the domain. Built as a study of how far a Nest +
GraphQL codebase can push generated, schema-derived plumbing instead of
hand-written boilerplate — keyset pagination, recursive filters, nested
connections, translated errors and query-cost limits are all written once and
reused by every entity.

## Stack

| Area     | Choice                                                |
| -------- | ----------------------------------------------------- |
| Runtime  | Node 24, NestJS 12, Fastify 5                         |
| API      | Apollo Server 5, code-first GraphQL schema            |
| Database | PostgreSQL 17, Prisma Next (`@prisma/orm-postgres` 8) |
| Build    | SWC (no `tsc` emit), TypeScript 7 for type checking   |
| Quality  | oxfmt, oxlint, Vitest, commitlint                     |
| i18n     | lingui 6 with the SWC macro plugin (`en`, `ro`, `ru`) |

## Quick start

```bash
docker compose up -d          # PostgreSQL on :55432
cp .env.example .env          # set DATABASE_URL and PORT
pnpm install                  # also emits the Prisma contract
pnpm prisma:migrate           # apply migrations
pnpm prisma:search-indexes    # trigram indexes for search
pnpm prisma:seed              # 6 monitors with 40 checks each
pnpm dev
```

GraphiQL is served at `http://localhost:$PORT/graphql` in development.
`GET /health` answers as soon as the process is up; `GET /health/ready` answers
`200` only after the database did.

## Commands

```bash
pnpm dev / start / build / prod
pnpm bundle                          # one-file build for the container image
pnpm typecheck                       # TypeScript 7
pnpm format / format:check
pnpm lint / lint:check
pnpm test / test:watch / test:cov    # unit, including the specs beside the code
pnpm test:e2e                        # against a real database
pnpm test:query:integration          # query core against a real database
pnpm prisma:emit                     # schema fragments -> contract
pnpm prisma:migrate-plan / migrate / migrate-status / db-verify / seed
pnpm prisma:search-indexes           # trigram indexes for search
pnpm i18n:extract / i18n:compile / i18n:verify
pnpm docs:api                        # static schema docs via spectaql
```

## Architecture

The schema is **contract-first**. Each feature owns a PSL fragment next to its
code (`src/modules/monitor/monitor.prisma`); a build step concatenates them into
one contract, and Prisma emits typed metadata from that. Migrations are planned
from the diff between the contract and the database, so a schema change that
needs a migration cannot be applied by accident.

`src` has four parts: `app` for the root module, `common` for leaf utilities
(errors), `core` for the machinery every feature runs on — config, GraphQL,
Prisma, i18n, pagination, rate limiting, the health probes — and `modules` for
the features.

A feature module is split one folder per entity inside each layer:

```bash
inputs/        GraphQL write surface
models/        @ObjectType classes
resolvers/     GraphQL surface: query args, the QueryDefinition, field resolvers
services/      business rules and errors; never touches Prisma
repositories/  the only place that talks to the database
types/         row types, enum value maps and repository write shapes
utils/         pure helpers, one folder per helper with its spec beside it
```

Repositories are plain injectable classes and their own DI tokens; a unit test
replaces one with a structural fake. Enum values, column defaults, relation
joins, column projections and the delete order used by the seed are all read
out of the generated contract rather than written by hand, so adding a model
rarely means editing plumbing.

## What the API does

**Monitors and probes.** `createMonitor` declares a URL, a method, an interval,
a timeout and the range of healthy status codes; `checkMonitor` probes it once
and records a `MonitorCheck`, and the monitor carries its latest state:
`lastStatus`, `lastCheckedAt`, `lastResponseTimeMs`, `consecutiveFailures`
and the next due time. Probe failures are classified (timeout, DNS, refused,
TLS, unexpected status) rather than collapsed into one error.

**Keyset pagination** on every list: `first`/`after`, `last`/`before`, opaque
cursors, `edges`, `nodes`, `pageInfo` and a `totalCount` that is only computed
if you ask for it. Ordering is explicit and stable — a unique tiebreaker is
appended automatically, changing `orderBy` mid-walk is rejected rather than
silently returning overlapping pages, and a page deep in the history costs the
same as the first one.

**Nested connections.** `Monitor.checks` pages every monitor of a list in one
statement, with `first`, `last` and `orderBy` but deliberately no filter; a
cursor issued there is not accepted by the root `monitorChecks` query.

**Recursive filters** with `and` / `or` / `not`, per-type operators, null checks
and relation quantifiers, plus a `search` argument over the fields a feature
declares searchable — including fields reached through a relation.

**Only the requested columns** are selected: the resolver reads the GraphQL
selection set and the repository projects to those columns plus whatever
ordering and cursors require.

**Translated errors.** Messages are declared inline where they are thrown and
resolved against the request's `Accept-Language`, with a compile-time check
that no message is missing a translation.

## Safety limits

Every request passes three gates before it can cost anything:

1. An HTTP-level rate limit that answers a real `429` before the query is
   parsed.
2. Per-operation rate-limit tiers (burst, sustained, hourly) tracked per IP,
   with a tighter budget for mutations.
3. A query depth limit and a query cost limit, both checked before execution,
   so an expensive shape is rejected without touching the database.

A probe never reads the response body, and the number of probes in flight is
capped; a `checkMonitor` past that cap is refused with `TOO_MANY_REQUESTS`
instead of queueing.

## Testing

Unit tests live beside the module code they cover and under `test/` for the
core: the query core (filters, ordering, cursors, projection, both query
lanes), the i18n service and catalogs, the relation loaders, the nested
connection and the seed's delete ordering. End-to-end and integration tests run
against a real PostgreSQL instance and cover pagination walks, filter
combinations, mutations, the parity of the two query lanes, the atomic probe
bookkeeping, the complexity and depth limits and both rate-limiting layers.

## License

UNLICENSED — private project.
