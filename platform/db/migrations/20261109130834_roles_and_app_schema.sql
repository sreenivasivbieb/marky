-- migrate:up

-- =====================================================================================================
-- Roles aur "app" schema: RLS ka foundation (ADR 0018).
--
-- Kaun kya hai:
--   admin (POSTGRES_USER)  superuser. Migrations chalata hai, tables ka owner. RLS bypass karta hai, isliye app
--                          isse KABHI connect nahi karta.
--   marky_app              app ka LOGIN role. Khud kuch nahi kar sakta (NOINHERIT); har transaction me
--                          `SET LOCAL ROLE marky_user` (ya marky_guest) karta hai.
--   marky_user             signed-in user ke rights (GRANTs + RLS policies).
--   marky_guest            share-link stakeholder. Abhi koi GRANT nahi; policies sharing step me (ADR 0018).
--
-- Roles poore Postgres server (cluster) ke hote hain, sirf ek DB ke nahi. marky_test DB isi server par hai, isliye
-- yahan "agar nahi hai to banao" (idempotent) likha hai.
-- Password yahan NAHI hai (repo public hai). `./dev db bootstrap` .env se set karta hai.
-- =====================================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'marky_app') THEN
    CREATE ROLE marky_app LOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'marky_user') THEN
    CREATE ROLE marky_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'marky_guest') THEN
    CREATE ROLE marky_guest NOLOGIN;
  END IF;
END
$$;

-- marky_app in roles me SWITCH kar sakta hai (SET TRUE), par unke rights apne aap nahi paata (INHERIT FALSE).
-- Matlab: bina `SET ROLE` ke marky_app ek bhi table nahi padh sakta.
GRANT marky_user  TO marky_app WITH INHERIT FALSE, SET TRUE;
GRANT marky_guest TO marky_app WITH INHERIT FALSE, SET TRUE;

-- public schema: default me har koi (PUBLIC) use kar sakta hai. Ise band karke sirf hamare roles ko dete hain.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO marky_user, marky_guest;

-- "app" schema: RLS helper functions yahan rehte hain, tables se alag.
CREATE SCHEMA app;
GRANT USAGE ON SCHEMA app TO marky_user, marky_guest;

-- Postgres default me har naye function ka EXECUTE sabko (PUBLIC) de deta hai. Ise band karo:
-- is schema me aage bane har function ke liye EXECUTE explicitly GRANT karna padega (least privilege).
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- -----------------------------------------------------------------------------------------------------
-- Actor: "is transaction me request kaun kar raha hai".
-- App har transaction me set karta hai:  SELECT set_config('app.actor', '{"kind":"user","id":"…"}', true)
-- Teesra argument `true` = sirf is transaction tak (SET LOCAL). COMMIT/ROLLBACK par apne aap mit jaata hai,
-- isliye connection pool me agli request ko purana actor kabhi nahi milta.
--
-- Limitation (ADR 0018): jo bhi SQL marky_user ke roop me chal raha hai, wo khud set_config kar sakta hai. Ye
-- design app code ke BUGS se bachata hai (WHERE bhool gaye), SQL injection se nahi. SQL injection se bachne ke liye
-- hamesha parameterised queries (Kysely) use karo.
-- -----------------------------------------------------------------------------------------------------

-- Actor JSON. Setting na ho to NULL (missing_ok = true), matlab "koi nahi", aur policies kuch nahi dikhati.
CREATE FUNCTION app.actor() RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT nullif(pg_catalog.current_setting('app.actor', true), '')::jsonb
$$;

-- Signed-in user ka id, ya NULL (guest / koi actor nahi).
CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN app.actor() ->> 'kind' = 'user' THEN (app.actor() ->> 'id')::uuid END
$$;

GRANT EXECUTE ON FUNCTION app.actor(), app.current_user_id() TO marky_user, marky_guest;


-- migrate:down

DROP SCHEMA app CASCADE;
REVOKE USAGE ON SCHEMA public FROM marky_user, marky_guest;
GRANT USAGE ON SCHEMA public TO PUBLIC;
-- Roles jaan-boojh kar DROP nahi kiye: wo poore server ke hain aur doosre DB (jaise marky_test) unhe use kar rahe ho sakte hain.
