# 0002. Package manager: pnpm (monorepo workspaces)
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
Design doc (section 6, 7) ke hisaab se ek web app + ek worker hoga, jo code share karenge (change engine, DB schema,
config). Ek repo me kai packages = **monorepo**. Package manager ko workspaces achhe se handle karne chahiye.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| pnpm | Fast; content-addressed store se disk bachta hai; strict (undeclared dependency import nahi hone deta); workspaces strong | Install alag se karna padta hai |
| npm | Node ke saath aata hai, familiar | Workspaces basic, slow, loose dependency resolution |
| bun | Bahut fast | Next.js / BullMQ ke edge cases me compatibility risk |

## Decision
**pnpm**, workspaces ke saath.

## Consequences
- Machine par pnpm installed nahi hai, aur Node 26 me corepack nahi aata. Install method alag decide hoga.
- Exact pnpm version repo me pin hoga (`packageManager` field), taaki har machine par same version chale.
- Strictness ki wajah se har package ko apni dependencies khud declare karni hongi. Ye achhi aadat hai.
