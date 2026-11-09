# 0003. Tunable config: TypeScript file + Zod validation
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
User ka rule (CLAUDE.md section 4): code me koi hardcoded value nahi. Tunables (timeouts, limits, spend caps, rate limits)
ek alag config file me rahenge, aur secrets/URLs (env vars) se **mix nahi** honge.
Design doc me aisi kai values hain: edit lock heartbeat 15 s, idle release 60 s, undo toast 10 s,
decision retrieval threshold ~200, AI log retention 30 din, waghera.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| TypeScript + Zod | Autocomplete; typo compile time par pakda jaata hai; schema aur values ek hi language me | Value badalne par rebuild/redeploy chahiye |
| YAML + Zod schema | Bina code chhue edit ho jaata hai | Types alag sync rakhne padenge; runtime file reading |
| Layered per-env YAML + "config doctor" | Powerful | Zyada kaam, MVP ke liye abhi zaroorat nahi |

## Decision
**TypeScript config file + Zod schema.** App start par Zod values check karega; galat value par app start hi nahi hogi
("fail fast").

## Consequences
- Tunables ki file aur env/secrets ka loader **do alag modules** honge, aur dono alag Zod schema se validate honge.
- Har tunable ke saath comment hoga: unit (ms/s/count), source (design doc ka section ya NFR id), aur kyun ye value hai.
- Per-environment override (dev me chhota timeout, waghera) chahiye ya nahi, ye abhi open hai. Zarurat aaye to user se poochhenge.
- Exact file path monorepo layout decide hone ke baad fix hoga.
