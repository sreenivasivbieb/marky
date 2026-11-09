# 0020. DB driver (pg), test database strategy, Kysely codegen, schema dump
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)
- Resolves: ADR 0011 / 0015 ka provisional "schema dump off"

## Decisions
| Topic | Faisla | Kyun |
|---|---|---|
| Driver | **`pg` (node-postgres)** + Kysely `PostgresDialect` | Kysely ka official dialect; stable; transaction + `SET LOCAL` pattern seedha chalta hai |
| Test DB | **Alag `marky_test` DB, har test ek transaction me jo ROLLBACK hota hai** | Dev data safe; tests ek-doosre ko affect nahi karte; data kabhi bachta nahi |
| Test command | **`./dev test`**: test DB banao (agar nahi hai) → dbmate migrate (`--env TEST_DATABASE_URL`) → bootstrap → vitest | Ek command, har baar sahi state |
| Codegen | `kysely-codegen` live DB (admin URL) se `platform/db/src/generated/database.ts` banata hai; file git me | ADR 0008: types haath se nahi. Column names snake_case hi (SQL jaisa) |
| Schema dump | **On**: `platform/db/schema.sql` git me | PR me dikhta hai migration ke baad schema asal me kaisa bana. dbmate image ka pg_dump 18.6 hai, server se match karta hai; `\restrict dbmate` fixed key hai, to dump deterministic hai |

## Flow (schema badalna ho to)
1. `./dev db new <naam>` → SQL likho (up + down)
2. `./dev db up` (schema.sql apne aap update hota hai)
3. `./dev pnpm --filter @marky/db db:types` (TS types regenerate)
4. `./dev test`

## Consequences
- Test helpers seeding ke liye admin connection use karte hain, phir `applyActor` se `marky_user` banke assert karte hain.
  Asli app login (`marky_app`) ka behaviour `roles.test.ts` alag se test karta hai.
- Error ke baad Postgres poora transaction abort kar deta hai, isliye "error aana chahiye" wale tests SAVEPOINT use karte hain.
- Dev container me admin URL (`MIGRATION_DATABASE_URL`, `TEST_ADMIN_DATABASE_URL`) maujood hai, codegen aur tests ke liye.
  Ye sirf dev me hai; production app container me admin URL kabhi nahi jaayega.
- Pool size (`maxConnections`) abhi `pg` ka default hai; asli value app/worker step me tunables se aayegi.
