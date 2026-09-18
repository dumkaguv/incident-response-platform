# incident-response-platform

A synthetic uptime and API monitoring platform: a `Monitor` describes an HTTP
resource, a probe records a `MonitorCheck`, history is read back over GraphQL.
The repository name predates the domain; `README.md` says how to run it.

Two processes: `src/main.ts` serves the API, **GraphQL only** and not one
controller, and `src/worker/main.ts` runs the probes with no HTTP server.
Filtering, search, ordering and cursor pagination come from the engine in
`core/`, so a feature declares a `QueryDefinition` and gets all four for free.

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
  common/   leaf utilities: errors, date-time
  core/     config, graphql, i18n, pagination, prisma, queue, throttler —
            the engine every feature runs on
  worker/   the second entry point: background jobs, no HTTP server
  modules/<feature>/
    <feature>.prisma  schema fragment — edit here, never the contract
    <feature>.module.ts       the API surface
    <feature>-jobs.module.ts  its queues and processors, loaded by the worker
    constants/  GraphQL type names, queue names and validation bounds
    inputs/     write surface, one <verb>-<entity>.input.ts each
    jobs/       processors, and the scheduler that fills their queue
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
folder per helper, with its spec beside it. **Tests live beside what they test**;
`test/` keeps only what belongs to no module.

## Architecture

Two layers under the resolver. The **repository** is the only thing that touches
the database and returns rows or `null`; a plain `@Injectable()` with no abstract
base, so faking one needs `as unknown as X`. The **service** holds the rules and
throws: `found(value, msg…)` from `common/utils` turns a `null` row into
`NotFoundError`, and `ConflictError` covers the rest.

Write types are **derived, not retyped**: `XCreateData = CreateXInput`,
`XUpdateData = UpdateXInput & { serverOnlyField?: … }`, in `inputs/` beside the
class they derive from.

**`class-validator` guards mutation inputs only** — query arguments go through
`normalizeQuery`. **A field a client may omit but not null is non-null with a
`defaultValue`**, never `nullable: true` plus `IsOptional`, which waves an
explicit `null` through to a `NOT NULL` column; the default comes from
`columnDefault(model, field)`, written once in the `.prisma`.

**A GraphQL type name is written once, in `constants/`.** It feeds `@ObjectType`,
`registerQueryEnum` and the `QueryDefinition`, and the schema breaks silently if
they drift. In a `QueryDefinition`, `filterable` and `sortable` default to true,
so a field states only its exceptions.

**A relation field belongs to the module owning the data**, not the one owning
the parent type — the other direction is a module cycle.

**Nothing reads `process.env` except `core/config/env.schema.ts`**, a Zod schema
run by `ConfigModule` as `validate`, so a bad value stops the boot naming the
variable. Consumers inject a namespace and receive typed values.

## Landmines

**Contract first, always.** Edit `src/modules/*/*.prisma`, never
`src/core/prisma/contract.prisma` — it is concatenated from the fragments. Then
`prisma:emit` and read the `contract.json` diff: a moved `storageHash` means the
database has to move. **`db migrate` does not advance `refs/db.json`**; advance it
by hand to the applied migration's **full** `to` hash, since a prefix reads as a
mismatch and every later plan branches from the wrong base.

**Messages are written where they are thrown**, as a lingui macro template. Ids
are hashes, so changed English surfaces as untranslated rather than leaving a
stale translation. After adding one: `pnpm i18n:extract`, translate, compile.

**Every index exists for one query pattern**, invisible on seed data. A column
without an index is not `sortable`, so a `QueryDefinition` states the exceptions.
Trigram indexes live outside the contract in `prisma/search-indexes/`.
