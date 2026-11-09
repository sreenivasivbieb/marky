# 0018. RLS design: actor claim + alag DB roles; marky_app bootstrap; guest policies baad me
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)
- Implements: NFR-11 (tenant isolation database me), design doc section 11

## Context
Ek database me kai tenants (products) hain. App code me ek bhi `WHERE` bhoolne se data leak na ho, isliye Postgres
**Row-Level Security** isolation enforce karega. DB ko har request par batana padta hai ki "kaun" pooch raha hai.
Superuser aur table owner RLS bypass karte hain, isliye app ko alag, kam-power wale login se chalna hoga.

## Options (context mechanism)
| Option | Fayda | Nuksaan |
|---|---|---|
| **Actor claim + DB roles** | GRANT level par bhi alagav (guest role user tables chhoo nahi sakta); ek hi system se user aur guest dono | Zyada concepts |
| Simple `app.user_id` setting | Aasaan | Guest ke liye alag rasta; GRANT par koi alagav nahi |
| Per-request `app.product_id` | Sabse simple policies | Multi-product screens (Dashboard) ke liye awkward |

## Decision
- **Roles** (migration `20261109130834`):
  - `marky_app`: LOGIN, NOINHERIT. Khud kuch nahi kar sakta; sirf neeche wale roles me `SET ROLE` kar sakta hai
    (`GRANT ... WITH INHERIT FALSE, SET TRUE`).
  - `marky_user`: signed-in user ke GRANTs + policies.
  - `marky_guest`: share-link stakeholder. **Abhi koi GRANT/policy nahi.** Guest access ka design sharing step me hoga,
    jab documents/comments tables honge (user ne ye sawal tab tak ke liye taala).
  - Admin (`POSTGRES_USER`): migrations, bootstrap, test seeding. App isse kabhi connect nahi karta.
- **Har request:** ek transaction → `SET LOCAL ROLE marky_user` → `set_config('app.actor', '{"kind":"user","id":…}', true)`.
  Dono LOCAL hain, to commit/rollback par mit jaate hain (`withActor()` in `@marky/db`).
- **Policies** helper functions se: `app.is_member()`, `app.is_owner()`, `app.shares_product_with()`. Ye SECURITY DEFINER
  hain (memberships par policy recursion se bachne ke liye), `search_path = ''` ke saath.
- **Do parat:** GRANT (kaunsi table/column) + POLICY (kaunsi rows). Jaise memberships par sirf `role` column UPDATE ho sakta hai.
- `public` schema se `PUBLIC` ka access hataya; sirf hamare roles ko USAGE hai. Naye `app.*` functions ka EXECUTE default
  me kisi ko nahi (`ALTER DEFAULT PRIVILEGES`).
- **Password bootstrap:** migration `marky_app` ko bina password banata hai (repo public hai). `./dev db bootstrap`
  `.env` ke `APP_DB_PASSWORD` se set karta hai. Prod me CI/deploy step yahi chalayega.
- **RLS `ENABLE` hai, `FORCE` nahi:** owner (admin) bypass karta hai, aur SECURITY DEFINER helpers isi par tike hain.
  App owner se kabhi connect nahi karta, aur ye ek test se verify hota hai.

## Consequences
- **Limitation:** `app.actor` setting ko `marky_user` ke roop me chal raha koi bhi SQL khud badal sakta hai. Ye design
  app ke *bugs* (WHERE bhoolna) se bachata hai, *SQL injection* se nahi. Isliye hamesha parameterised queries (Kysely) use karo.
- Role names (`marky_app`, `marky_user`) migration, `docker-compose.yml`, `./dev` aur `actor.ts` me aate hain. Source of
  truth migration hai; baaki jagah comment me reference diya hai.
- Roles server-wide hain; `marky_test` DB same roles share karta hai, isliye role migration idempotent hai aur down
  migration roles drop nahi karta.
- Verified (2026-11-09): 18 DB tests + mutation probe (products ka RLS band karne par exactly 4 read/update tests fail hue,
  aur INSERT wala test GRANT ki wajah se phir bhi pass hua).
