---
name: add-feature-module
description: Add a new feature module or HTTP endpoint to capsule-api following its conventions. Use when creating a NestJS module, controller, service or route, for example wardrobe, style profile, occasions or feedback.
---

# Add a feature module

Model new code on `src/auth/` and `src/models/`. Read them first.

## Files

One folder per feature under `src/<feature>/`:

- `<feature>.schemas.ts`: Zod schemas for every request and response, with inferred types.
- `<feature>.service.ts`: all logic. Injects `DB`, `ENV` and other services by explicit token.
- `<feature>.controller.ts`: translates HTTP to service calls and nothing else.
- `<feature>.module.ts`: registered in `src/app.module.ts`.
- `<name>.spec.ts` beside any pure logic.

## Rules that are easy to miss

- ESM: relative imports end in `.js`. Use `import type` for types.
- Every constructor parameter has `@Inject(Token)`.
- Bodies, queries and params: `@Body({ schema })`, `@Query({ schema })`, `@Param('id', { schema })`.
- Responses: `@ApiResponse({ status, standardSchema })` on every route, plus `@ApiBearerAuth()`.
- Routes need a token by default. Add `@Public()` only with a stated reason.
- Take the user from `@CurrentUser()`. Never accept a user id from the body, query or path.
- Every query on user-owned rows filters by that user id. A missing row and another user's row
  both return 404.
- Read configuration from the injected `ENV`, never `process.env`.
- Files and photos never pass through the API. Issue a presigned URL instead.

## Tests

- Unit: pure functions in `src/**/*.spec.ts`.
- Integration: the service with a real database, `test/integration/<feature>.int-spec.ts`, using
  `createTestDb()`.
- End to end: `test/e2e/<feature>.e2e-spec.ts` using `createTestApp()`. Always include: 401
  without a token, 400 on invalid input, and user B cannot read or change user A's data.

## Finish

1. `npm run openapi` and keep the updated `openapi.json`.
2. Add the new paths to the list in `test/e2e/openapi.e2e-spec.ts`.
3. `npm run check`.
