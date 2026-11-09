-- migrate:up

-- =====================================================================================================
-- Tenancy core: users, products, memberships + RLS (ADR 0018, 0019).
-- Tenant boundary = product. User kisi product ka data tabhi dekhta hai jab uski membership ho.
--
-- Conventions (ADR 0019):
--   id            uuid, DEFAULT uuidv7() (Postgres 18 native, time-ordered)
--   fixed values  text + CHECK (TS ke `as const` arrays se match), Postgres ENUM nahi
--   email         sirf lowercase store hota hai (CHECK), app save se pehle normalise kare
-- =====================================================================================================

CREATE TABLE public.users (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  email      text        NOT NULL UNIQUE
                         CHECK (email = lower(btrim(email)) AND email <> ''),
  name       text,                                   -- magic-link se aaye user ka naam shuru me nahi hota
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  name        text        NOT NULL CHECK (btrim(name) <> ''),
  plan        text        NOT NULL DEFAULT 'free' CHECK (plan IN ('free')),  -- baaki plans pricing tay hone par
  created_by  uuid        NOT NULL REFERENCES public.users (id),             -- history; owner = memberships
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz                                                    -- FR-01 archive (NULL = active)
);

CREATE TABLE public.memberships (
  product_id uuid        NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('owner', 'reviewer', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, user_id)       -- ek user ek product me ek hi baar
);
-- PK (product_id, user_id) "is product ke members" fast deta hai; ye index ulta lookup ke liye: "is user ke products".
CREATE INDEX memberships_user_id_idx ON public.memberships (user_id);

-- =====================================================================================================
-- RLS helper functions
--
-- SECURITY DEFINER = function apne OWNER (admin) ke rights se chalta hai, caller ke nahi. Isliye ye memberships
-- table padh sakte hain, chahe caller ko us row ki permission na ho. Agar policy khud memberships par seedha
-- query karti, to memberships ki policy dobara chalti (infinite recursion).
--
-- SECURITY DEFINER khatarnaak tool hai, isliye har ek me:
--   * `SET search_path = ''`: koi attacker apna fake `memberships` table pehle search path me nahi daal sakta;
--     hum sab kuch schema ke saath likhte hain (public.memberships).
--   * sirf current actor ke baare me jawab dete hain; koi arbitrary user_id leke data nahi lautate.
-- =====================================================================================================

-- Current user ka is product me role, ya NULL.
CREATE FUNCTION app.member_role(p_product_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.role
  FROM public.memberships AS m
  WHERE m.product_id = p_product_id
    AND m.user_id = app.current_user_id()
$$;

CREATE FUNCTION app.is_member(p_product_id uuid) RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT app.member_role(p_product_id) IS NOT NULL $$;

CREATE FUNCTION app.is_owner(p_product_id uuid) RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT app.member_role(p_product_id) IS NOT DISTINCT FROM 'owner' $$;

-- Kya current user aur p_user_id kisi ek product me saath hain? (Ek doosre ka naam/email dekhne ke liye.)
CREATE FUNCTION app.shares_product_with(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS mine
    JOIN public.memberships AS theirs ON theirs.product_id = mine.product_id
    WHERE mine.user_id = app.current_user_id()
      AND theirs.user_id = p_user_id
  )
$$;

GRANT EXECUTE ON FUNCTION
  app.member_role(uuid), app.is_member(uuid), app.is_owner(uuid), app.shares_product_with(uuid)
TO marky_user;

-- =====================================================================================================
-- Product create: chicken-and-egg ka hal (ADR 0018)
-- Policy kehti hai "members sirf owner jod sakta hai", par naye product ka koi owner hai hi nahi. Isliye ek
-- SECURITY DEFINER function EK transaction me product + creator ki owner membership banata hai.
-- marky_user ko products par seedha INSERT ka GRANT nahi hai; product sirf isi function se banta hai.
-- =====================================================================================================
CREATE FUNCTION app.create_product(p_name text) RETURNS public.products
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := app.current_user_id();
  v_product public.products;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'only a signed-in user can create a product'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.products (name, created_by)
  VALUES (p_name, v_user_id)
  RETURNING * INTO v_product;

  INSERT INTO public.memberships (product_id, user_id, role)
  VALUES (v_product.id, v_user_id, 'owner');

  RETURN v_product;
END
$$;

GRANT EXECUTE ON FUNCTION app.create_product(text) TO marky_user;

-- =====================================================================================================
-- Invariant: har product me kam se kam ek owner (ADR 0019: multiple owners allowed).
-- Aakhri owner ko hataya ya demote nahi kiya ja sakta. Pehle kisi aur ko owner banao.
-- =====================================================================================================
CREATE FUNCTION app.keep_at_least_one_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Sirf tab check karo jab ek owner ja raha ho (delete, ya role 'owner' se kuch aur).
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'owner') THEN
    -- Product row ko lock karo. Do log ek saath do alag owners ko demote karein (race condition) to dono check pass
    -- karke product bina owner ke reh sakta tha. Lock se dono ek-ek karke chalte hain.
    -- Product hi delete ho raha ho (ON DELETE CASCADE), to row nahi milegi aur check skip ho jaayega.
    PERFORM 1 FROM public.products WHERE id = OLD.product_id FOR UPDATE;
    IF FOUND AND NOT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE product_id = OLD.product_id
        AND role = 'owner'
        AND user_id <> OLD.user_id
    ) THEN
      RAISE EXCEPTION 'product % must keep at least one owner', OLD.product_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER memberships_keep_at_least_one_owner
BEFORE UPDATE OR DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION app.keep_at_least_one_owner();

-- =====================================================================================================
-- Row-Level Security
-- Do parat (defense in depth):
--   1. GRANT  -> role kaunsi TABLE / COLUMN chhoo sakta hai
--   2. POLICY -> us table ki kaunsi ROWS
-- Policy `TO marky_user` hai. marky_guest ke liye koi policy nahi, to RLS on hote hi guest ko 0 rows milti hain.
-- (Note: UPDATE/DELETE ki policy se bahar wali rows par error nahi aata; wo bas "0 rows affected" hota hai.)
-- =====================================================================================================

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- users: khud ko, aur jinke saath koi product share karte ho unhe dekh sakte ho. Sirf apna naam badal sakte ho.
-- (users me INSERT sign-in flow karega; wo Auth step me aayega.)
GRANT SELECT, UPDATE (name) ON public.users TO marky_user;

CREATE POLICY users_select ON public.users FOR SELECT TO marky_user
  USING (id = app.current_user_id() OR app.shares_product_with(id));

CREATE POLICY users_update_self ON public.users FOR UPDATE TO marky_user
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());

-- products: members dekhte hain; sirf owners rename/archive karte hain. INSERT sirf app.create_product() se.
-- DELETE kisi ko nahi (archive karo; hard delete retention job karega).
GRANT SELECT, UPDATE (name, archived_at) ON public.products TO marky_user;

CREATE POLICY products_select_members ON public.products FOR SELECT TO marky_user
  USING (app.is_member(id));

CREATE POLICY products_update_owners ON public.products FOR UPDATE TO marky_user
  USING (app.is_owner(id))
  WITH CHECK (app.is_owner(id));

-- memberships: members apne product ke members dekhte hain; sirf owners jodte, role badalte, hatate hain.
-- UPDATE sirf `role` column ka. Membership ko doosre product/user par khiskana allowed nahi.
GRANT SELECT, INSERT (product_id, user_id, role), UPDATE (role), DELETE ON public.memberships TO marky_user;

CREATE POLICY memberships_select_members ON public.memberships FOR SELECT TO marky_user
  USING (app.is_member(product_id));

CREATE POLICY memberships_insert_owners ON public.memberships FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id));

CREATE POLICY memberships_update_owners ON public.memberships FOR UPDATE TO marky_user
  USING (app.is_owner(product_id))
  WITH CHECK (app.is_owner(product_id));

CREATE POLICY memberships_delete_owners ON public.memberships FOR DELETE TO marky_user
  USING (app.is_owner(product_id));


-- migrate:down

-- Order zaroori hai: jo cheez kisi aur par depend karti hai, wo pehle jaayegi.
-- create_product() ka return type `products` hai, isliye wo table se pehle jaata hai. Tables drop hone par unki
-- policies aur trigger saath chale jaate hain; uske baad hi trigger function drop ho sakta hai.
DROP FUNCTION app.create_product(text);
DROP TABLE public.memberships;
DROP TABLE public.products;
DROP TABLE public.users;
DROP FUNCTION app.keep_at_least_one_owner();
DROP FUNCTION app.shares_product_with(uuid);
DROP FUNCTION app.is_owner(uuid);
DROP FUNCTION app.is_member(uuid);
DROP FUNCTION app.member_role(uuid);
