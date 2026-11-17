# capsule-api

Backend for **Capsule**, an AI stylist that builds outfits from a user's own wardrobe, budget and the market.

NestJS 12 · TypeScript (ESM) · PostgreSQL + Drizzle · LangChain · Zod · Vitest

This service owns all business logic and every model call. The web app (`capsule-web`) and the
future Expo app (`capsule-mobile`) are separate repositories that talk to it over the versioned
HTTP API and generate their typed clients from `openapi.json`.

## Getting started

Requirements: Node 22.12+, Docker Desktop, [Ollama](https://ollama.com) for local models.

```bash
npm install
npm run setup                 # creates .env with a generated secret, starts Postgres + SeaweedFS, migrates
ollama pull gemma4:12b && ollama pull nomic-embed-text
npm run start:dev
```

- API: http://localhost:3000/v1
- Interactive docs: http://localhost:3000/docs (disabled in production)
- Metrics: http://localhost:3000/metrics

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with reload |
| `npm run check` | Everything CI runs: format, lint, typecheck, all tests, build |
| `npm run test:unit` / `test:int` / `test:e2e` | One test layer |
| `npm run test:cov` | Tests with coverage |
| `npm run openapi` | Regenerate `openapi.json` (commit the result) |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

## Layout

```
src/
  config/     Environment schema; the app refuses to start on bad config
  db/         Drizzle schema and connection
  auth/       Register, login, refresh-token rotation, global auth guard
  models/     ModelRouter: maps a task (vision, reasoning, embedding) to a provider and model
  metrics/    Prometheus registry, HTTP middleware, /metrics endpoint
  health/     Liveness and readiness
  app.setup.ts  HTTP configuration shared by the server and the e2e tests
test/
  integration/  Services against a real Postgres engine
  e2e/          The whole application over HTTP
  support/      Test database, test app, fake model provider
drizzle/      SQL migrations
```

## Testing

| Layer | Location | Scope |
|---|---|---|
| Unit | `src/**/*.spec.ts` | Pure logic, no I/O |
| Integration | `test/integration/*.int-spec.ts` | A service plus the database |
| End to end | `test/e2e/*.e2e-spec.ts` | HTTP in, HTTP out, production configuration |

Integration and e2e tests run on [PGlite](https://pglite.dev), Postgres compiled to WebAssembly,
with the project's real migrations applied. They need no Docker and each test gets its own
database. Model calls go to a fake provider, so tests never need a GPU.

## Test chat (playground)

`POST /v1/playground/chat` is a developer endpoint for seeing how the model behaves: it streams
tokens, tool calls, tool results and timings as Server-Sent Events. It is the backend for the
test chat in `capsule-web`.

- Stateless: the client sends the whole conversation each time.
- Three sample tools over fixed sample data: `get_today`, `search_wardrobe`, `get_dress_code`.
- The request can override the system prompt and switch tools off, to compare behaviour.
- Returns 404 in production.

Code is in `src/playground/`. The sample data there is for testing only and is replaced by the
real wardrobe and occasion library as those are built.

## Model routing

Feature code asks the router for a task and never names a vendor:

```ts
const reply = await modelRouter.chat('vision').invoke(messages);
```

Routing is configuration (`MODEL_VISION=ollama:gemma4:12b`). To move a task to a cloud model,
implement `ModelProvider` (`src/models/providers/`), register it in `ModelsModule`, and change the
variable. Every call through the router is counted and timed in the metrics.

## Metrics

`GET /metrics` serves Prometheus text format:

- `http_requests_total`, `http_request_duration_seconds` by method, route pattern and status
- `llm_requests_total`, `llm_request_duration_seconds`, `llm_tokens_total` by task, provider and model
- Node.js process metrics (event loop lag, heap, GC)

`docker compose --profile observability up -d` starts Prometheus on http://localhost:9090.

## Security

- **Secure by default:** every route requires a bearer token unless marked `@Public()`.
- **Passwords:** scrypt with per-password salt; parameters are stored with the hash.
- **Sessions:** 15-minute access JWT (HS256, algorithm pinned) plus an opaque refresh token that
  is stored hashed, single use, and rotated. Replaying a used refresh token revokes that login.
- **Input:** every body is validated with Zod; JSON bodies are capped at 100 kB.
- **Abuse:** per-IP rate limiting, with a stricter limit on credential endpoints.
- **Transport and browser:** Helmet headers, CORS restricted to `CORS_ORIGINS`.
- **Configuration:** validated at startup; production additionally requires `METRICS_TOKEN` and
  explicit CORS origins. Secrets live only in `.env`, which is git-ignored.
- **Supply chain:** CI runs `npm audit` on production dependencies.

Before deploying: terminate TLS in front of the service, and if it sits behind a proxy or load
balancer, configure Express `trust proxy` so rate limiting sees real client addresses.

## API contract

`openapi.json` is generated from the Zod schemas and committed. CI fails if it is stale. Clients
generate types from it, for example:

```bash
npx openapi-typescript ../capsule-api/openapi.json -o src/api/schema.d.ts
```

Breaking changes go into a new version (`/v2/...`); mobile users keep old builds for a long time.
