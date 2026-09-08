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
  common/       pagination + query core, errors, is-dev
  graphql/      driver config, dataloaders, filters, scalars, query limits
  i18n/         I18nService, locales, generated catalogs (committed)
  prisma/       generated contract + db/query/enum/where adapters
  throttler/    two-layer rate limiting
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

**`db migrate` does not advance `migrations/app/refs/db.json`.** That file pins
the chain head; a stale ref makes every later `migration plan` branch from the
wrong base. Advance it to the applied migration's `to` hash — the **full** hash,
since a prefix reads as a hash mismatch.

**What PSL can and cannot say about indexes.** Composite btree yes; `type:` from
`btree`/`gin`/`hash`/`brin` yes, but **lowercase only**; per-column `sort:` and
operator classes no. Expression indexes parse and emit correct SQL —
`@@index(expression: "title gin_trgm_ops", type: "gin", map: "…")` — **but do
not use them**: introspection reads the opclass back as a plain column, so
contract and database never agree and `db migrate` always ends in "schema does
not satisfy contract". The trigram indexes therefore live outside the contract,
in `prisma/search-indexes/`; `db verify` is not strict and tolerates them.

**Every index exists for one query pattern**, measured on 200k skewed rows and
invisible on seed data. `(createdAt, id)` serves the default keyset order — the
tuple comparison and the tiebreak both, scanned backwards since every column is
DESC. `(status, createdAt, id)` serves a status filter with that order: 23 ms
and a full scan without it, 7.8 ms with. `teamMember (teamId, name)` serves the
batched relation fetch and its ordering in one scan: 13.8 ms against 0.29 ms.
Trigram GIN is the largest win — a rare term goes from 140 ms to 0.3 ms.

**The bundle is built from `dist`, not `src`.** SWC has already emitted the
decorator metadata by then, so esbuild never has to understand decorators.
`keepNames` is mandatory — the code-first schema is built from class names.
Imports that cannot be resolved are externalised automatically by a plugin and
printed, so a new dependency needs no change here; a genuinely missing one shows
up in that list. Anything reached through Nest's runtime package loader cannot
work in a bundle, which is why `ServeStaticModule` is registered only when its
directory exists. Bundling is also what makes startup fast: 1.1 s against 4.2 s
unbundled.

**`DEFAULT_ORDER_BY` is global** (`createdAt DESC`, then `id DESC`). Entries an
entity cannot honour are skipped, not rejected. `orderBy` is the only sorting
argument and each array element carries exactly one path — `[{ createdAt:
'DESC' }, { id: 'DESC' }]`, never `[{ createdAt: 'DESC', id: 'DESC' }]`. The
unique tiebreaker is appended automatically.

**The ORM lane cannot order through a relation** — a relation accessor exposes
only `some`/`every`/`none`. `listConnection` switches to a two-phase SQL-lane
query for that case; to-many relations there throw. NULLS placement other than
PostgreSQL's own default also throws. Both fail loudly because losing either
corrupts keyset pagination.

**`@Field(() => DateTimeScalar)`, never `@Field(() => Date)`.** The contract
returns timestamps as ISO strings and `GraphQLISODateTime.serialize` returns
`null` for a string without throwing, which would silently null out every
timestamp.
