\restrict dbmate

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- Name: actor(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.actor() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT nullif(pg_catalog.current_setting('app.actor', true), '')::jsonb
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT products_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT products_plan_check CHECK ((plan = 'free'::text))
);


--
-- Name: create_product(text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.create_product(p_name text) RETURNS public.products
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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


--
-- Name: current_user_id(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT CASE WHEN app.actor() ->> 'kind' = 'user' THEN (app.actor() ->> 'id')::uuid END
$$;


--
-- Name: is_member(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.is_member(p_product_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$ SELECT app.member_role(p_product_id) IS NOT NULL $$;


--
-- Name: is_owner(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.is_owner(p_product_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$ SELECT app.member_role(p_product_id) IS NOT DISTINCT FROM 'owner' $$;


--
-- Name: keep_at_least_one_owner(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.keep_at_least_one_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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


--
-- Name: member_role(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.member_role(p_product_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT m.role
  FROM public.memberships AS m
  WHERE m.product_id = p_product_id
    AND m.user_id = app.current_user_id()
$$;


--
-- Name: shares_product_with(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.shares_product_with(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS mine
    JOIN public.memberships AS theirs ON theirs.product_id = mine.product_id
    WHERE mine.user_id = app.current_user_id()
      AND theirs.user_id = p_user_id
  )
$$;


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'reviewer'::text, 'viewer'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    email text NOT NULL,
    name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_email_check CHECK (((email = lower(btrim(email))) AND (email <> ''::text)))
);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (product_id, user_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: memberships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id);


--
-- Name: memberships memberships_keep_at_least_one_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memberships_keep_at_least_one_owner BEFORE DELETE OR UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION app.keep_at_least_one_owner();


--
-- Name: memberships memberships_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships memberships_delete_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memberships_delete_owners ON public.memberships FOR DELETE TO marky_user USING (app.is_owner(product_id));


--
-- Name: memberships memberships_insert_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memberships_insert_owners ON public.memberships FOR INSERT TO marky_user WITH CHECK (app.is_owner(product_id));


--
-- Name: memberships memberships_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memberships_select_members ON public.memberships FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- Name: memberships memberships_update_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memberships_update_owners ON public.memberships FOR UPDATE TO marky_user USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_select_members ON public.products FOR SELECT TO marky_user USING (app.is_member(id));


--
-- Name: products products_update_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_update_owners ON public.products FOR UPDATE TO marky_user USING (app.is_owner(id)) WITH CHECK (app.is_owner(id));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select ON public.users FOR SELECT TO marky_user USING (((id = app.current_user_id()) OR app.shares_product_with(id)));


--
-- Name: users users_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_self ON public.users FOR UPDATE TO marky_user USING ((id = app.current_user_id())) WITH CHECK ((id = app.current_user_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261109130834'),
    ('20261109130836');
