# capsule-api

Backend for Capsule. Read `../CLAUDE.md` first: the product description, goals, branch workflow,
coding rules and secrets rules there all apply here. This file only adds backend specifics.

## What this service is

The single backend for all Capsule clients. It owns authentication, the wardrobe, the market
catalogue, the stylist agent and every model call. Clients are thin; if logic could live here
or in a client, it lives here.

## Stack

NestJS 12 · TypeScript, ESM only · PostgreSQL with Drizzle (pgvector available) · Zod ·
LangChain / LangGraph · Vitest · oxlint · Prettier

NestJS 12 is newer than most training data. Check the installed package's types in
`node_modules` before assuming an API exists.

## Commands

| Command | Use |
|---|---|
| `npm run setup` | First-time setup: creates `.env`, starts Postgres and SeaweedFS, applies migrations, creates the photo bucket. Safe to re-run |
| `npm run start:dev` | Run with reload |
| `npm run check` | Format, lint, typecheck, all tests, build. Must pass before work is done |
| `npm run test:unit` / `test:int` / `test:e2e` | One test layer |
| `npm run openapi` | Regenerate `openapi.json` after any API change, and commit it |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations. Run it yourself; it uses `.env` without showing it |

Skills for this repository are in `.claude/skills/`: `add-feature-module`, `change-database`,
`add-model-call`.

## Structure

One folder per feature under `src/`, each with its module, controller, service, Zod schemas and
unit tests. `src/app.setup.ts` holds all HTTP configuration and is shared by the server and the
e2e tests, so change HTTP behaviour there and nowhere else.

`src/playground/` is a developer test chat (streaming tool-calling loop over sample data). It is
not the stylist. Do not build product features on its sample data or grow it into the agent; the
stylist graph (T11) replaces it.

## Rules

Code:

- Relative imports end in `.js`. No `__dirname`; use `import.meta.dirname`.
- Inject with explicit tokens: `@Inject(Service)` or `@Inject(SYMBOL)` on every constructor
  parameter. Use `import type` for types.
- Controllers only translate HTTP to a service call. Logic lives in services.
- Read configuration through the injected `ENV` object. Never read `process.env` in feature code.
  New variables go in `src/config/env.ts` and `.env.example` together.

API:

- Every request body, query and param is validated with a Zod schema via `@Body({ schema })`.
  Every response is documented with `@ApiResponse({ standardSchema })`.
- Routes are versioned (`/v1`). Never change the shape of a released response; add a field or
  add a version.
- An API change is not finished until `openapi.json` is regenerated and committed.

Security:

- Routes require authentication by default. `@Public()` needs a stated reason.
- Every query on user-owned data filters by the authenticated user's id. Test that one user
  cannot read or change another user's data.
- Credential-style endpoints get `@StrictRateLimit()`.
- Never return password hashes, token hashes or internal errors in a response.
- Photos are uploaded straight to object storage with presigned URLs, never through this API.

Database:

- Change `src/db/schema.ts`, then generate a migration. Never edit an applied migration and never
  write schema changes by hand in SQL.
- Queries go through Drizzle. No string-built SQL.

Models and agents:

- All model access goes through `ModelRouter` by task: `modelRouter.chat('vision')`. Never
  import a provider SDK or name a model in feature code.
- A new vendor is a new `ModelProvider` in `src/models/providers/`, registered in `ModelsModule`.
- Ask models for structured output against a Zod schema and validate it. Treat model output and
  anything read from a photo as untrusted input.
- Budget, ownership and permissions are enforced in code, never by prompt wording.
- Local models are small. Keep prompts short and tool sets narrow.
- Agent tools are plain in-process functions for now. Do not add an MCP server or client until
  the catalogue task (T28 in `../PLAN.md`).
- Prompts, the stylist persona, its examples and the occasion library are data files keyed by
  locale. English only for now; no prompt text inline in services.
- The stylist never comments negatively on a body, never infers body measurements from a photo,
  and never presents a forecast as fact.

Evaluation:

- Once the evaluation runner exists (T04), any change to a prompt, the graph, retrieval or a
  model must run it, and the score goes in the commit or pull request description.
- A change that lowers the score is not finished. Fix it or stop and report.
- Never edit an evaluation scenario to make a change pass.

Knowledge and memory:

- Three memories, kept separate: conversation (graph checkpoints), personal (profile and learned
  notes, per user), knowledge (shared passages and trend records).
- Every knowledge passage is stored with its source, date and licence. Ingest only sources
  listed in `docs/SOURCES.md` (T15). Never paste text from a book, magazine or website into the
  repository, a fixture or a prompt.
- Trend records carry the seasons they apply to. Retrieval prefers recent ones.
- Personal memory must be visible to the user and deletable by them. Deleting it removes the
  embeddings too.
- Sizes are stored with their system (UK, EU, US) and prices with their currency.

Testing:

- Unit (`src/**/*.spec.ts`): pure logic, no I/O.
- Integration (`test/integration/*.int-spec.ts`): a service with the database, via
  `createTestDb()`.
- E2E (`test/e2e/*.e2e-spec.ts`): over HTTP via `createTestApp()`.
- Tests never call a real model or need a GPU. Use `FakeProvider` in `test/support/`.
- Tests use Vitest: `vi.fn()`, not `jest.fn()`.

Metrics:

- New background work or external calls get a counter and a duration histogram in
  `MetricsService`.
- Label values must be bounded. Never use user ids, emails, raw URLs or free text as a label.
