# incident-response-platform

A synthetic uptime and API monitoring platform: a `Monitor` describes an HTTP
resource, a probe records a `MonitorCheck`, history is read back over GraphQL.
The repository name predates the domain; `README.md` says how to run it.

The API is **GraphQL only** — not one controller. Filtering, search, ordering
and cursor pagination come from the engine in `core/`, so a feature declares a
`QueryDefinition` and gets all four without writing a query.

## Rules

- Package manager is **pnpm**. Never `npm install` or `yarn`.
- **No comments in code**, anywhere; prose belongs here. Comment syntax a tool
  reads is not a comment: `// use prisma-next` atop every `.prisma`, and the
  generator headers in `src/core/i18n/generated/*` and `contract.json`.
- **Type check with `pnpm typecheck` (TS 7).** A bare `tsc` resolves to 5.x,
  which exists only for the oxlint JS-plugin bridge.
- **oxfmt + oxlint only.** Never reintroduce Prettier or ESLint.
- Aliases `@/*` → `src/*`, `~/*` → repo root. **A relative import may not
  climb**: `./` for the same folder, `@/` for everything else — any `../` is a
  lint error, so moving a file never rewrites the imports inside it.
- Conventional commits. **Two configs exist and only `.commitlintrc` is read**,
  so the `type-enum` in `commitlint.config.cts` is dead.

## Structure

```bash
src/
  app/      root module
  common/   leaf utilities: errors
  core/     config, graphql, i18n, pagination, prisma, throttler —
            the engine every feature runs on
  modules/<feature>/
    <feature>.prisma  schema fragment — edit here, never the contract
    <feature>.module.ts
    constants/  GraphQL type names and validation bounds
    inputs/     write surface, one <verb>-<entity>.input.ts each
    models/     @ObjectType classes
    resolvers/  resolver, its @ArgsType, and the QueryDefinition
    services/   rules and errors
    repositories/  the only place that touches the database
    types/      row types, enum value maps, repository write shapes
    utils/      pure helpers — no DI, no database
    index.ts    in every folder; imports address the folder, not the file
```

Every layer except `constants/` splits **one folder per entity** —
`models/monitor/`, `models/monitor-check/`, never two files side by side — and a
layer holding one entity keeps the folder anyway. `utils/` goes one further: a
folder per helper. **Tests live beside what they test**; `test/` keeps only what
belongs to no module.

## Architecture

Two layers under the resolver. The **repository** is the only thing that touches
the database and returns rows or `null`; a plain `@Injectable()` and its own DI
token, with no abstract base — row types come from the contract anyway, and the
cost is that faking one needs `as unknown as X`. The **service** holds the rules
and throws `NotFoundError` / `ConflictError`.

Write types are **derived, not retyped**: `XCreateData = CreateXInput`,
`XUpdateData = UpdateXInput & { serverOnlyField?: … }`, in `inputs/` beside the
class they derive from. An entity with no write surface derives from nothing, so
its write shape is a plain type in `types/`.

**`class-validator` guards mutation inputs only** — query arguments go through
`normalizeQuery`. `whitelist` is off: GraphQL rejects unknown fields itself, and
`whitelist` deletes any field without a decorator. **A field a client may omit
but not null is non-null with a `defaultValue`**, never `nullable: true` plus
`IsOptional`, which waves an explicit `null` through to a `NOT NULL` column; the
default comes from `columnDefault(model, field)`, written once in the `.prisma`.
`UpdateXInput` extends `PartialType(CreateXInput, { omitDefaultValues: true,
skipNullProperties: false })`: a patch must not reset an omitted field, and an
explicit `null` must reach the inherited validators.

**A GraphQL type name is written once, in `constants/`.** `XTypeName` feeds
`@ObjectType`, `registerQueryEnum` and the `QueryDefinition`; the schema breaks
silently if they drift, and `ArgName` does the same for argument names. In a
`QueryDefinition`, `filterable` and `sortable` default to true, so a field states
only its exceptions. Descriptions are for the client reading the schema: what a
field is, never how it is fetched.

**A relation field belongs to the module owning the data**, not the one owning
the parent type — the other direction is a module cycle. A to-many is exposed
through one `NestedConnection({…})` call: paging and ordering, deliberately no
filter or search.

**Nothing reads `process.env` except `core/config/env.schema.ts`**, a Zod schema
run by `ConfigModule` as `validate`, so a bad value stops the boot naming the
variable. Consumers inject a namespace and receive typed values.

## Landmines

**Messages are written where they are thrown**, as a lingui macro template. Ids
are hashes, so changed English surfaces as untranslated rather than leaving a
stale translation. After adding one: `pnpm i18n:extract`, translate, compile.

**Contract first, always.** Edit `src/modules/*/*.prisma`, never
`src/core/prisma/contract.prisma` — it is concatenated from the fragments. Then
`prisma:emit` and read the `contract.json` diff: a moved `storageHash` means the
database has to move. **`db migrate` does not advance `refs/db.json`**; advance
it by hand to the applied migration's **full** `to` hash, since a prefix reads as
a mismatch and every later plan branches from the wrong base.

**The planner stops at data, not at schema.** Dropped columns, removed enum
values, indexes and `setNotNull` it handles alone; anything needing a decision
about existing rows scaffolds a `dataTransform` with placeholders only an author
can fill. Rebaselining instead is a shortcut that dies with the first deploy.

**Every index exists for one query pattern**, invisible on seed data:
`(created_at, id)` for the default keyset order, scanned backwards;
`(monitor_id, checked_at, id)` for one monitor's history; `(is_active,
next_check_at, id)` for the scheduler claim. Trigram indexes live outside the
contract in `prisma/search-indexes/` — introspection reads an opclass back as a
plain column. A column without an index is not `sortable`: on 500k checks an
`ORDER BY response_time_ms` is a 51 ms parallel seq scan, so `monitorCheckQuery`
states the exceptions and offers ordering on `checkedAt` and `id` only.

**A keyset page is one row comparison, not a branch per key.** `(a < $1) OR (a
= $1 AND b < $2)` is filtered row by row from the index end — 62 ms and 400 001
rows removed at offset 400k on 500k checks — while `row(a, b) < row($1, $2)`
is an index condition and costs 0.12 ms on any page. `keysetFilter` emits the
`tuple` node whenever every sort key is a non-null root scalar of one direction
and the cursor holds no null; both lanes compile it through `Combinators.row`
from probes the field ops already type (`row(col, col) < row($1, $2)`). The
branch form stays for nullable or mixed-direction keys, and for the classic
Prisma fixture in `core.integration-spec`, which is why `specToPrisma` takes
`{ rowComparison: true }` from `query-table` instead of defaulting to it.

**A nested connection is a `LATERAL` per parent and counts lazily.** The
`row_number() OVER (PARTITION BY …)` form sorted every check of every listed
monitor — 372 ms and 24 MB on disk for 25 parents — where `unnest(parents)
CROSS JOIN LATERAL (… ORDER BY … LIMIT n)` reads `n + 1` index entries per
parent in 0.4 ms. The `count(*) GROUP BY` runs only when `totalCount` is
selected, through its own loader. The nested spec is normalized under
`<Parent>.<field>`, so its cursors carry a fingerprint the root query of the same
model refuses.

**A probe never reads the body and never runs unbounded.** `response.body.cancel()`
replaces `arrayBuffer()`, and `MonitorLimit.probesInFlight` caps the runs a
process holds at once; past it `checkMonitor` answers `TOO_MANY_REQUESTS` instead
of queueing. Handing probes to a scheduler is the next step, not this one.

**A probe outcome is one data-modifying CTE** in
`MonitorCheckRepository.recordOutcome`: `INSERT … RETURNING` the check, then
`UPDATE monitor … FROM inserted` for the summary, in one statement through
`raw.sql`, so a failure between the two can no longer leave a check without a
summary. The check is stamped with the moment the probe *started*, and the
summary moves only when `last_checked_at IS NULL OR last_checked_at <=
checked_at`: a slow probe that finishes after a newer one stays in the history
and leaves the state alone. `consecutive_failures = CASE WHEN … THEN + 1 ELSE 0
END` and `next_check_at = checked_at + make_interval(secs => interval_seconds)`
still happen in the row, never from a stale read. A monitor deleted mid-probe
inserts nothing and answers `null`. A `param(...)` instance is one placeholder:
interpolating the same object twice makes PostgreSQL deduce two types for it,
so build a fresh one per position. An empty patch to `update` is a read,
because the ORM answers `null` for an update that sets nothing. `checkMonitor`
on a paused monitor is `CONFLICT`, and `expectedStatusMin` may not exceed
`expectedStatusMax`, checked on create and against the stored bounds on update.

**`GET /health/ready` runs `SELECT 1`**; `GET /health` does not touch the
database, so a database outage never restarts the process through its liveness
probe. Unit tests run isolated: the shared module registry let a `vi.mock` hold
only under one file order.

**The platform is Fastify, and four things follow.** Nest middleware runs
through middie and is handed the raw `IncomingMessage`, which carries no `ip`
or `ips` — so anything that identifies a client is a Fastify `onRequest` hook
instead. `HttpThrottlerHook` is registered from `ThrottlerConfigModule` and
scoped by `request.routeOptions.url`; as a `NestMiddleware` it would have keyed
every caller as `ip:unknown` and no type would have said so. `trustProxy`
refuses a hop count — Fastify fails closed on a number because a hop count
cannot validate the immediate peer — so `TRUST_PROXY` takes `true`, `false` or
an address list, and a number is rejected by the env schema rather than
silently trusting nothing. It is read in `main.ts` before the adapter exists,
which is why `.env` is loaded there when it is present. `app.listen(port)`
binds localhost under Fastify where Express bound every interface, so the host
is passed explicitly. And `fastify` is held by a pnpm override at the exact
version `@nestjs/platform-fastify` depends on: two copies in the tree break
plugin registration and make every `FastifyRequest` structurally incompatible
with itself.

**Fragment walkers memoize by name.** `queryDepth` and `connectionSelection`
visit each fragment once per document. Without that, 20 levels of doubling
spreads in an 884-byte valid document cost 3.5 s of synchronous CPU before
`getComplexity`, which has its own node budget, ever ran. The cycle guard stays
for documents that never reached validation.

**One rate-limit bucket per tier, operation kind and client.**
`GqlThrottlerGuard.generateKey` hashes `tier:read|write:client`. The parent
guard keyed by resolver class and method, which handed every root field its own
budget and let a request sidestep an exhausted bucket by leading with a field
nobody had asked for yet; the per-request verdict cache is keyed by tier, so
bucket and verdict now cover the same thing. A rate-limited GraphQL response is
an HTTP 429 through `createErrorFormatter`, which answers that status whenever
an error carries `TOO_MANY_REQUESTS`: Mercurius sends the status the formatter
returns and discards the one the guard set on the reply, while the `Retry-After`
header the guard set survives. Write tiers read `THROTTLE_WRITE_*_LIMIT`;
the e2e suites raise the write burst because they create, probe and delete back
to back.

**A nested page loader is keyed by fingerprint, direction and limit.** The
cursor fingerprint deliberately excludes the page size, so two aliases of one
field with different `first` shared a loader, and a page, until the loader key
carried both. Nested connections issue cursors but take no `after`/`before`:
a later page is read through the root query with a filter on the foreign key.

**`DateTime` is exact text, never a JavaScript `Date`.** `common/utils/date-time.ts`
formats the PostgreSQL text form as RFC 3339 with every fractional digit and
accepts only an RFC 3339 date-time with an offset and a real calendar day;
filters and cursors validate with the same rules. Round-tripping through `Date`
lost microseconds, so an `eq` filter with a value the API had just returned
matched nothing, and `March 5, 2020` was a valid input.

**The validation pipe is `APP_PIPE` in `GraphqlConfigModule`.** Every generated
args class answers `toSpec()` only after class-transformer instantiated it, so a
host without the pipe fails every list query with `args.toSpec is not a
function`. `AppErrorFilter` checks the host type: an `AppError` from an HTTP
controller gets a JSON body under the status its code maps to instead of a
`GraphQLError` nobody sends. `GET /health/ready` races `SELECT 1` against a
three second timer and answers 503 when the timer wins.

**There is no authentication, and a probe target is any http(s) URL.** Anyone
who reaches the API can create a monitor pointing at an internal address and
have the server probe it; the body is never read, but status, timing and error
class leak. Running behind a perimeter is the operating condition until an auth
layer and a target policy exist. Deferred with it: translating the English
`BadUserInputError` texts in `core/pagination`, a shared throttler store for
several replicas, and `include` of a second relation hop on the SQL lane, which
today includes only `path[0]` of a sort path and would break cursor encoding
for a two-hop relation sort that no module exposes yet.

**A `preExecution` hook that returns errors does not stop the query.** Mercurius
appends them to the response and executes anyway, so `guardQueryLimits` throws:
returning a refusal let a query worth 50 101 complexity reach the database while
still answering `BAD_USER_INPUT`, and no test saw it because the limit and the
message were both right. The hook is given the schema as its first argument, so
nothing injects `GraphQLSchemaHost`; it reads `operationName` off the request
because the signature does not carry one, and `getComplexity` throws on a
multi-operation document without it. **Errors reach the formatter nested**: a
validation failure arrives as one `MER_ERR_GQL_VALIDATION` carrying the real
errors in `originalError.errors`, and formatting the wrapper answers `Graphql
validation error` with no code where the client expects
`GRAPHQL_VALIDATION_FAILED`. The formatter is per response, not per error, which
is why it also owns the status — 429 when any error is `TOO_MANY_REQUESTS`, 400
when no error carries a `path` and so nothing reached a resolver. **The explorer
lives at `/graphiql`**, not at the GraphQL path the way Apollo served it, so `/`
redirects there; `introspection` is not an option and is refused by adding
`NoSchemaIntrospectionCustomRule` to `validationRules`.
