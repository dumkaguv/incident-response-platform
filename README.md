# incident-response-platform

A GraphQL API for tracking incidents: what broke, how badly, who owns it, and
when it was resolved. Built as a study of how far a Nest + GraphQL codebase can
push generated, schema-derived plumbing instead of hand-written boilerplate —
keyset pagination, recursive filters, batched relations, translated errors and
query-cost limits are all written once and reused by every entity.

## Stack

| Area     | Choice                                                |
| -------- | ----------------------------------------------------- |
| Runtime  | Node 24, NestJS 12, Express 5                         |
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
pnpm prisma:seed              # 4 teams, 10 incidents, 8 members
pnpm dev
```

GraphiQL is served at `http://localhost:$PORT/graphql` in development.

## Commands

```bash
pnpm dev / start / build / prod
pnpm bundle                          # one-file build for the container image
pnpm typecheck                       # TypeScript 7
pnpm format / format:check
pnpm lint / lint:check
pnpm test / test:watch / test:cov    # unit
pnpm test:e2e                        # against a real database
pnpm test:query:integration
pnpm prisma:emit                     # schema fragments -> contract
pnpm prisma:migrate-plan / migrate / migrate-status / db-verify / seed
pnpm prisma:search-indexes           # trigram indexes for search
pnpm i18n:extract / i18n:compile / i18n:verify
pnpm docs:api                        # static schema docs via spectaql
```

## Architecture

The schema is **contract-first**. Each feature owns a PSL fragment next to its
code (`src/modules/incident/incident.prisma`); a build step concatenates them
into one contract, and Prisma emits typed metadata from that. Migrations are
planned from the diff between the contract and the database, so a schema change
that needs a migration cannot be applied by accident.

`src` has four parts: `app` for the root module, `common` for leaf utilities
(errors, environment readers),
`core` for the machinery every feature runs on — GraphQL, Prisma, i18n,
pagination, rate limiting — and `modules` for the features.

A feature module is four thin layers:

```bash
resolvers/   GraphQL surface: query args, the QueryDefinition, field resolvers
services/    business rules and errors; never touches Prisma
repositories/  the only place that talks to the database
types/       row types and enum value maps, both derived from the contract
```

Repository contracts are abstract classes so Nest can inject them and tests can
replace them. Enum values, relation joins, column projections and the delete
order used by the seed are all read out of the generated contract rather than
written by hand, so adding a model rarely means editing plumbing.

## What the API does

**Keyset pagination** on every list: `first`/`after`, `last`/`before`, opaque
cursors, `edges`, `nodes`, `pageInfo` and a `totalCount` that is only computed
if you ask for it. Ordering is explicit and stable — a unique tiebreaker is
appended automatically, and changing `orderBy` mid-walk is rejected rather than
silently returning overlapping pages.

**Recursive filters** with `and` / `or` / `not`, per-type operators, null checks
and relation quantifiers, plus a `search` argument over the fields a feature
declares searchable — including fields reached through a relation.

**Batched relations.** Every relation field goes through a per-request
dataloader, so a page of 100 incidents costs one query for the incidents and
one for their teams, not 101. Nesting a relation cycle deeper adds no queries at
all.

**Only the requested columns** are selected: the resolver reads the GraphQL
selection set and the repository projects to those columns plus whatever
ordering and cursors require.

**Translated errors.** Messages are declared inline where they are thrown and
resolved against the request's `Accept-Language`, with ICU plurals and a
compile-time check that no message is missing a translation.

## Safety limits

Every request passes three gates before it can cost anything:

1. An HTTP-level rate limit that answers a real `429` before the query is
   parsed.
2. Per-operation rate-limit tiers (burst, sustained, hourly) tracked per user
   or per IP, with a tighter budget for mutations.
3. A query depth limit and a query cost limit, both checked before execution,
   so an expensive shape is rejected without touching the database.

The cost budget is calibrated against the most expensive legitimate query
rather than guessed, because in a cyclic schema depth alone is a poor proxy for
cost.

## Testing

Unit tests cover the query core (filters, ordering, cursors, projection,
expression compilation), the i18n service and catalogs, the relation loaders and
the seed's delete ordering. End-to-end tests run against a real PostgreSQL
instance and cover pagination walks, filter combinations, mutations, nested
relations, the complexity and depth limits and both rate-limiting layers.

## License

UNLICENSED — private project.
