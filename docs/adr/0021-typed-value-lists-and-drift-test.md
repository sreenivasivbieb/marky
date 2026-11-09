# 0021. Typed value lists (DB CHECK ↔ TS) + drift test
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)
- Resolves: ADR 0019 ka "type gap"

## Context
ADR 0019 me fixed values `text + CHECK` me hain. `kysely-codegen` CHECK constraints nahi padhta, isliye
`memberships.role` ka TS type `string` aata tha, aur `role: "admin"` compile ho jaata tha.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| **TS `as const` list + codegen override + drift test** | Compile-time safety; drift test dono ko sync rakhta hai | Value do jagah likhi jaati hai (test isi ko guard karta hai) |
| DB se TS generate (custom script) | Ek hi source | Custom codegen maintain karna padega |
| Baad me | Abhi kaam kam | Galtiyan runtime par hi pakdi jaati |

Lists kahan rahein: **`platform/db`** (modules me rakhte to platform → modules import hota, jo ADR 0007 todta;
alag `platform/domain` package ek extra package hota).

## Decision
- `platform/db/src/value-lists.ts`: `MEMBERSHIP_ROLES`, `PRODUCT_PLANS` (`as const`) + `VALUE_LISTS` registry.
- `platform/db/.kysely-codegenrc.json`: har list ke column par override, aur value-lists ka import.
- **Pattern har text+CHECK column par lagega** (user ka faisla), sirf role par nahi.
- `value-lists.test.ts` (generic drift test):
  - DB ke **har** `CHECK (col IN (...))` constraint ko `VALUE_LISTS` se milata hai (missing, extra, ya alag value = fail);
  - codegen config me har list ka override hai, ye bhi check karta hai.

## Consequences
- Naya text+CHECK column: migration → `value-lists.ts` → codegen config → `db:types`. Koi step bhoole to drift test fail.
- **Tooling finding (TS 7 side effect, ADR 0016):** kysely-codegen overrides parse karne ke liye `typescript` ka JS API
  use karta hai, par use dependency ki tarah declare nahi karta. Isliye wo root ka TS 7 (native, bina JS API) utha leta tha,
  aur imports **chupchaap** gayab ho jaate the. Fix: `pnpm-workspace.yaml` → `packageExtensions` se kysely-codegen ko
  `typescript@5.9.3` diya. Type-check ab bhi TS 7 hi karta hai.
- Verified (2026-11-09) teen mutation probes se: TS list me extra value → drift test fail; code me `role: "admin"` →
  TS2322; DB me naya unregistered constraint → drift test fail.
