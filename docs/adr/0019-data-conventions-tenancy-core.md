# 0019. Data conventions + tenancy core (users, products, memberships)
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Decisions
| Topic | Faisla | Kyun / trade-off |
|---|---|---|
| Primary keys | **UUIDv7** (`DEFAULT uuidv7()`, Postgres 18 native) | Time-ordered, to B-tree index fast; ID se count ya agla ID guess nahi hota. bigint guessable hai, UUIDv4 index fragment karta hai |
| Fixed values (roles, plan, states) | **`text` + `CHECK (... IN (...))`** | Value jodna/hatana ek simple migration; Postgres ENUM se value hatana mushkil hai; lookup table zaroorat se zyada hai |
| Email | **Sirf lowercase store** (`CHECK (email = lower(btrim(email)))`) + normal UNIQUE | App save se pehle normalise kare; bhoole to DB error dega, chupchaap duplicate nahi banega |
| Owners | **Multiple owners**, `memberships.role = 'owner'` se; `products.created_by` sirf history ke liye | Design doc ka open question "ek se zyada Owner?" ab **haan** se band. Doc ka `products.owner_id` nahi rakha (deviation) |
| Last owner | DB trigger aakhri owner ko hatane/demote karne nahi deta; race se bachne ke liye product row lock karta hai | Invariant DB me hai, to koi bhi code path ise tod nahi sakta |
| Product create | **`app.create_product(name)`** SECURITY DEFINER: product + owner membership ek transaction me | "Members sirf owner jode" wali policy ka chicken-and-egg; products par direct INSERT kisi ko allowed nahi |
| `products.plan` | Rakha gaya: `DEFAULT 'free'`, `CHECK (plan IN ('free'))` | Design doc se match; baaki plans pricing tay hone par migration se |
| Archive | `products.archived_at` (NULL = active); hard DELETE kisi role ko nahi | FR-01; hard delete retention job karega (design doc section 8) |
| Scope | Is step me sirf 3 tables. Baaki 11 apne module ke step me | Chhota step, aur focus RLS par |

## Consequences
- **Type gap:** `kysely-codegen` CHECK constraints nahi padhta, to `memberships.role` ka TS type `string` aata hai,
  `'owner' | 'reviewer' | 'viewer'` nahi. Isse kaise sambhalna hai, ye user ke saath decide hona baaki hai.
- `users` me INSERT abhi kisi app role ko allowed nahi; sign-in flow (Auth step) ke saath design hoga.
- Member jodne ke liye owner ko user ka `id` chahiye, par wo un users ko dekh nahi sakta jinke saath product share nahi
  karta. Invite-by-email flow (FR-02) apne step me design hoga.
