# 0017. `@marky/config` design: env loader + tunables (per-env overrides, lazy validation)
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)
- Builds on: ADR 0003 (TS + Zod), CLAUDE.md section 4 (secrets aur tunables mix nahi)

## Decision
`platform/config` package me **do alag hisse**, alag files aur alag Zod schemas ke saath:

| Hissa | Source | Kya | Validation kab |
|---|---|---|---|
| `env` | `process.env` (Compose daalta hai; app `.env` file khud nahi padhta) | `APP_ENV`, `DATABASE_URL`, `VALKEY_URL` | **Lazy**: `getEnv()` ki pehli call par, phir cached |
| `tunables` | `src/tunables/base.ts` + `overrides.ts` (git me) | Timeouts, limits, retention days, waghera | **Import par**: base + har environment ka merged result validate |

- **Per-environment:** `base.ts` me saari values hain. `overrides.ts` me `development` / `test` / `production` ke sirf badle
  hue hisse hain (typed, deep-partial). `APP_ENV` env var sirf **environment ka naam** deta hai. Koi tunable value env var se nahi aati.
- **Startup check:** `assertConfig()` env + tunables dono validate karta hai. App aur worker start hote hi ise call karenge,
  taaki galti turant pakdi jaaye (fail fast) aur Next.js build bhi na toote.
- **Strict schemas:** unknown key (jaise override me typo `heartbeatMS`) error deta hai, chupchaap ignore nahi hota.
- **Units naam me:** `...Ms`, `...Days`, `...Count`, taaki "15 kya? second ya ms?" waali galti na ho.
- **Cross-field rules** schema me hain (jaise heartbeat interval < idle release time).
- Error message me **secret values kabhi print nahi hongi**; sirf field ka naam aur kya galat hai.

## Consequences
- Pehle tunables design doc ki di hui values se aaye hain, har ek ke saath source (section/NFR) comment me hai.
  Naya tunable tabhi jodna hai jab code use kare.
- `APP_ENV` ko `.env` me rakha gaya hai (default `development`). Vitest khud `test` set karta hai.
