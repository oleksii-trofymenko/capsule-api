---
name: change-database
description: Change the capsule-api database schema safely with Drizzle migrations. Use when adding or altering tables, columns, indexes or pgvector embedding columns.
---

# Change the database

1. **Edit `src/db/schema.ts` only.** Follow the existing tables: `uuid` primary key with
   `defaultRandom()`, `timestamp(..., { withTimezone: true })`, snake_case column names.
2. **User-owned tables** have a `user_id` foreign key with `onDelete: 'cascade'` and an index on
   it. Deleting a user must remove everything of theirs.
3. **Generate the migration:** `npm run db:generate -- --name <short-name>`. This needs no
   database and no `.env`.
4. **Read the generated SQL** in `drizzle/`. Check it does what you intended and nothing else.
   Never edit a migration that has already been committed; make a new one.
5. **Apply it locally:** `npm run db:migrate`. It uses `.env` without showing it; never open
   that file yourself. If the database is not running, `npm run setup` starts it.
6. **Test through the real migrations.** `createTestDb()` applies everything in `drizzle/`, so
   integration and end-to-end tests exercise the new schema automatically. Add tests for new
   constraints (uniqueness, cascade).

## Embedding columns (pgvector)

- The first migration that uses vectors must start with `CREATE EXTENSION IF NOT EXISTS vector;`.
  Add that line to the top of the generated SQL of that one migration before committing it.
- Column: `vector('embedding', { dimensions: N })`, where N matches the embedding model in use.
  Store the embedding model's name in a column beside it; vectors from different models cannot
  be compared.
- Index: HNSW with `vector_cosine_ops`.
- Check that PGlite in the tests loads the vector extension; if `createTestDb()` needs a change
  for that, make it in `test/support/test-db.ts` and say so.
- Every similarity query on user data also filters by `user_id`.

## Never

- Hand-write schema changes in SQL outside a generated migration.
- Build SQL from strings. Use Drizzle's query builder or the `sql` template tag.
- Store secrets, raw tokens or full photos in the database.
