# incident-response-platform

`README.md` says what this is and how to run it. This file is the rules and the
landmines.

## Rules

- Package manager is **pnpm**. Never `npm install` or `yarn`.
- **No comments in code.** None, anywhere in `src`, `test`, `tools`, `prisma`
  or the root configs. Names and structure carry the meaning; prose belongs
  here. Comment syntax a tool reads is not a comment and must survive:
  `// use prisma-next` as the first line of every `.prisma` file, and the
  generator headers in `src/i18n/generated/*` and `contract.json`.
- **Type check with TypeScript 7**: `pnpm typecheck`. A bare `tsc` resolves to
  5.x, which exists only for the oxlint JS-plugin bridge. If an error looks
  stale, delete `dist/*.tsbuildinfo`.
- **oxfmt + oxlint only.** Do not reintroduce Prettier or ESLint. `.prettierrc`
  is a leftover that nothing reads.
- Aliases are `@/*` → `src/*` and `~/*` → repo root. A relative import may not
  climb two levels — `../../x` is a lint error.
- Commit messages are conventional commits. **Two configs exist and only
  `.commitlintrc` is read**, so the `type-enum` in `commitlint.config.cts` is
  dead.

## Commands

```bash
pnpm dev                  # watch mode
pnpm typecheck            # TS 7
pnpm format / lint        # oxfmt --write / oxlint --fix
pnpm format:check / lint:check
pnpm test                 # unit
pnpm test:e2e             # needs the database
pnpm prisma:emit          # fragments -> contract (run after editing a .prisma)
pnpm prisma:migrate-plan  # write a migration from the contract diff
pnpm prisma:migrate       # apply it
pnpm prisma:db-verify     # database matches the contract
pnpm prisma:seed
pnpm i18n:extract / i18n:compile / i18n:verify
pnpm bundle               # build, then esbuild it to one file
```

## Structure

```bash
src/
  app/          root module
  common/       leaf utilities: errors, isDev, env readers
  core/         machinery every feature runs on
    graphql/    driver config, dataloaders, filters, scalars, query limits
    i18n/       I18nService, locales, generated catalogs (committed)
    pagination/ the query engine: spec, filters, order, cursors, connection
    prisma/     generated contract + db/query/enum/where adapters
    throttler/  two-layer rate limiting
  modules/<feature>/
    <feature>.prisma          schema fragment — edit here
    <feature>.module.ts
    inputs/     GraphQL write surface + the repository data types
    models/     @ObjectType classes
    resolvers/  resolver, its @ArgsType, and the QueryDefinition
    services/   rules and errors, never sees Prisma
    repositories/  <feature>.repository.interface.ts + .prisma.repository.ts
    types/      row type + enum value maps
```

Two layers under the resolver. The **repository** is the only place that
touches the database and returns rows or `null`. Its contract is an **abstract
class**, not an `interface` — an interface has no runtime identity so it cannot
be a Nest DI token. The module binds
`{ provide: XRepositoryInterface, useClass: XPrismaRepository }`, so a test can
hand the service a fake. The **service** holds the rules, throws
`NotFoundError` / `ConflictError`, and never sees Prisma.

Write types are **derived, not retyped**: `XCreateData = CreateXInput` and
`XUpdateData = UpdateXInput & { serverOnlyField?: … }`, declared in `inputs/`
because `inputs` already imports the enum maps from `types` and declaring them
in `types` would close an import cycle.

**A relation field belongs to the module that owns the data, not the module
that owns the parent type.** `Team.incidents` is resolved from `IncidentModule`
because `IncidentModule` already imports `TeamModule`; the other direction
would be a module cycle.

## Landmines

**Four SWC lanes, and a per-file plugin has to reach all of them.** Build reads
`.swcrc`; tests read the inline object in `vitest.config.ts`; dev, start and the
scripts read `.swcrc` only through `tools/swc/register.mjs`, a shim that sets
`SWCRC=1` because `@swc-node/register` otherwise derives everything from
`tsconfig.json`. Miss one and only that lane breaks.

**Messages are written where they are thrown**, as a lingui macro template — no
`defineMessages`, no `*.messages.ts`, no custom extractor. Ids are hashes, so
changing the English text surfaces as untranslated instead of leaving a stale
translation. Values are baked into the descriptor, so `AppError` carries no
`values` argument. A simple identifier becomes a named placeholder; any other
expression becomes `{0}`, so bind it to a local first. After adding a message:
`pnpm i18n:extract`, translate, `pnpm i18n:compile`.

**Contract first, always.** Edit `src/modules/*/*.prisma`, never
`src/prisma/contract.prisma` — it is concatenated from the fragments. Then
`prisma:emit` and read the `contract.json` diff: a moved `storageHash` means the
database has to move too.

**`db migrate` does not advance `migrations/app/refs/db.json`.** A stale ref
makes every later `migration plan` branch from the wrong base. Advance it to the
applied migration's `to` hash — the **full** one; a prefix reads as a mismatch.

**Physical names are snake_case, model names are not** — `@map`/`@@map` on every
column and table, so the database reads `created_at`, `team_id`, `team_member`.
**Prisma Next cannot rename**: the planner emits zero operations for a name
change and the DSL has no `renameColumn`/`renameTable`, so `@map` only reaches a
database created with those names — changing one later means squashing to a new
baseline and recreating the database. A baseline is planned by deleting
`refs/db.json` outright; a database is fresh only once `prisma_contract` is
dropped too, since that schema holds the marker.

**Migrations run from `--target migrate`**, never the app image: the tooling is
1 GB minimum (610 MB of it `alchemy`/`workerd` via the Prisma CLI) against
213 MB for the runtime. A deployed database uses the manual `migrate` workflow.

**Introspection is exempt from the cost limit** — it nests lists inside lists,
so the fanout multiplier priced GraphiQL's schema fetch at 617 005 and broke the
explorer; an e2e test covers it. `GRAPHIQL` decides whether the explorer and
introspection are on; they used to hang off `NODE_ENV`, so a deploy that never
set it served an open schema and leaked error details by accident.

**What PSL can and cannot say about indexes.** Composite btree yes; `type:` from
`btree`/`gin`/`hash`/`brin` yes, **lowercase only**; per-column `sort:` and
operator classes no. Expression indexes parse and emit correct SQL but **must
not be used**: introspection reads the opclass back as a plain column, so
contract and database never agree. Trigram indexes therefore live outside the
contract, in `prisma/search-indexes/`; `db verify` tolerates them.

**Every index exists for one query pattern**, measured on 200k skewed rows and
invisible on seed data: `(createdAt, id)` for the default keyset order, scanned
backwards since all columns are DESC; `(status, createdAt, id)` for a status
filter under that order, 23 ms without it against 7.8 ms with;
`team_member (team_id, name)` for the batched relation fetch and its ordering in
one scan, 13.8 ms against 0.29 ms; trigram GIN for search, 140 ms against
0.3 ms on a rare term.

**The bundle is built from `dist`, not `src`** — SWC has already emitted the
decorator metadata, so esbuild never handles decorators. `keepNames` is
mandatory: the code-first schema is built from class names. Unresolvable imports
are externalised automatically and printed, so a new dependency needs no change.
Anything reached through Nest's runtime package loader cannot work bundled,
which is why `ServeStaticModule` registers only when its directory exists.
Startup drops from 4.2 s to 1.1 s.

**`DEFAULT_ORDER_BY` is global** (`createdAt DESC`, then `id DESC`); entries an
entity cannot honour are skipped, not rejected. `orderBy` is the only sorting
argument and each element carries exactly one path — `[{ createdAt: 'DESC' }, {
id: 'DESC' }]`, never `[{ createdAt: 'DESC', id: 'DESC' }]`. The unique
tiebreaker is appended automatically.

**The ORM lane cannot order through a relation** — a relation accessor exposes
only `some`/`every`/`none`. `listConnection` switches to a two-phase SQL-lane
query for that case; to-many relations there throw. NULLS placement other than
PostgreSQL's own default also throws. Both fail loudly because losing either
corrupts keyset pagination.

**`@Field(() => DateTimeScalar)`, never `@Field(() => Date)`.** The contract
returns timestamps as ISO strings and `GraphQLISODateTime.serialize` returns
`null` for a string without throwing, which would silently null out every
timestamp.
