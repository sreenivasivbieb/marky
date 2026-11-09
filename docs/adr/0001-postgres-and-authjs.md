# 0001. Database: plain PostgreSQL, Auth: Auth.js
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
Design doc (section 7, 8; NFR-11) maangta hai:
- Relational data + transactions (Change accept = block + version + audit event, ek saath).
- Tenant isolation **database me** (Row-Level Security), sirf app code ke bharose nahi.
- Login: Google + email magic link (FR-35).
- Stakeholder link wale guests jinka koi user account nahi hota, unke liye bhi RLS sahi chalna chahiye.

Ye learning project hai, isliye concepts ka dikhna bhi ek requirement hai.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| A. Plain Postgres (Docker) + Auth.js | RLS, migrations, sessions sab khud likhte hain, concepts saaf dikhte hain; vendor lock-in nahi | Setup aur code zyada |
| B. Supabase | Postgres + Auth + Storage ready, jaldi start | Bahut kuch "magic"; guest-token RLS uske auth model ke bahar hai; lock-in |
| C. Postgres + Better Auth | Flexible, modern | Chhoti community |

## Decision
**Option A**: Docker me PostgreSQL (local dev), production me managed Postgres. Authentication ke liye Auth.js.

## Consequences
- RLS policies aur "har request par tenant context set karna" hum khud design karenge (Step 1 ka bada learning topic).
- Guest (stakeholder link) ke liye alag DB context chahiye hoga. Ye design abhi baaki hai aur user ke saath discuss hoga.
- File storage (S3-compatible) aur email ka provider alag se chunna padega, kyunki Supabase ki tarah bundled nahi milega.
- Auth.js ke DB tables humare schema ke saath milane padenge (doc ki `users` table).
