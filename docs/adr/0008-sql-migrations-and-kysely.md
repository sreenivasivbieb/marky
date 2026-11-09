# 0008. DB access: plain SQL migrations + Kysely query builder
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
14 core tables (design doc section 8), RLS policies har customer-content table par (NFR-11), aur transactions
(Change accept). Learning project hai, isliye SQL aur RLS dikhne chahiye, ORM ke peeche chhupne nahi chahiye.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| SQL migrations + Kysely | Asli SQL dikhta hai; RLS policies plain SQL me; Kysely type-safe hai aur koi magic nahi | SQL khud likhna padega |
| Drizzle ORM | Schema TS me, migrations auto-generate | SQL kam dikhta hai |
| Prisma | Popular | RLS / per-request `SET` ke saath awkward; runtime bhaari |

## Decision
- **Schema ka source of truth = `.sql` migration files** (`platform/db/migrations/`).
- **Kysely** se type-safe queries. Iske TS types live database se generate honge (codegen), haath se nahi likhenge.

## Consequences
- Flow: SQL migration likho → migrate chalao → types regenerate karo → TS code me use karo.
- Migration runner (kaun sa tool SQL files chalayega) abhi decide hona baaki hai.
- RLS ke liye har request par transaction ke andar tenant context set karna hoga (`SET LOCAL ...`). Iska exact design
  alag discussion me hoga (guest/stakeholder case ke saath).
