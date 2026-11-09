# Architecture Decision Records (ADR)

**ADR kya hai?** Ek chhota document (ek page) jo ek important technical faisla record karta hai:
kya decide hua, kyun, aur iska asar kya hoga. Code batata hai *kya* bana; ADR batata hai *kyun* bana.
6 mahine baad koi poochhe "Postgres kyun, Supabase kyun nahi?", to jawab yahan milega.

**Kab likhte hain?** Jab koi faisla baad me badalna mehenga ho (database, auth, framework, data model),
ya jab design doc se hatke kuch karte hain (deviation).

**Rules (is repo ke liye)**
- File name: `NNNN-short-title.md` (number kabhi reuse nahi hota).
- Har ADR user ki approval ke baad hi `Accepted` hota hai.
- ADR edit nahi karte. Faisla badle to naya ADR likho jo purane ko `Superseded` kare,
  bilkul jaise product me Decisions supersede hote hain.

**Template**
```
# NNNN. Title
- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: user (+ AI ne options diye)

## Context      — problem kya hai, kya constraints hain
## Options      — kaunse rasté the, har ek ke trade-off
## Decision     — kya chuna
## Consequences — iska fayda/nuksaan, aage kya karna padega
```

## Index
| # | Title | Status |
|---|---|---|
| 0001 | [Postgres + Auth.js](0001-postgres-and-authjs.md) | Accepted |
| 0002 | [pnpm monorepo](0002-pnpm-package-manager.md) | Accepted |
| 0003 | [Tunable config: TypeScript + Zod](0003-config-typescript-zod.md) | Accepted |
| 0004 | [Phase 0 aur MVP parallel](0004-phase0-parallel-with-mvp.md) | Superseded by 0014 |
| 0005 | [Docker Compose dev toolbox](0005-docker-compose-dev-toolbox.md) | Accepted |
| 0006 | [git + GitHub](0006-git-and-github.md) | Accepted |
| 0007 | [Monorepo layout: apps / modules / platform](0007-monorepo-layout-domain-modules.md) | Accepted |
| 0008 | [SQL migrations + Kysely](0008-sql-migrations-and-kysely.md) | Accepted |
| 0009 | [Valkey instead of Redis](0009-valkey-instead-of-redis.md) | Accepted |
| 0010 | [Debian trixie-slim base image](0010-debian-slim-base-image.md) | Accepted |
| 0011 | [dbmate migration runner](0011-dbmate-migration-runner.md) | Accepted |
| 0012 | [Phase 0: AI drafts, user interviews](0012-phase0-ai-drafts-user-interviews.md) | Superseded by 0014 |
| 0013 | [Design doc copy in repo, no Google link](0013-design-doc-in-repo.md) | Accepted |
| 0014 | [Skip Phase 0; MVP only](0014-skip-phase0-validation.md) | Accepted |
| 0015 | [Dev environment details](0015-dev-environment-details.md) | Accepted |
| 0016 | [No-build TypeScript (Node native) + Vitest](0016-no-build-typescript-and-vitest.md) | Accepted |
| 0017 | [`@marky/config` design](0017-config-module-design.md) | Accepted |
| 0018 | [RLS: actor claim + DB roles](0018-rls-actor-claim-and-db-roles.md) | Accepted |
| 0019 | [Data conventions + tenancy core](0019-data-conventions-tenancy-core.md) | Accepted |
| 0020 | [pg driver, test DB, codegen, schema dump](0020-db-driver-testing-codegen.md) | Accepted |
| 0021 | [Typed value lists + drift test](0021-typed-value-lists-and-drift-test.md) | Accepted |
| 0022 | [Change engine design (schema + model)](0022-change-engine-design.md) | Accepted |
