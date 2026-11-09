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
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    product_id uuid NOT NULL,
    actor_type text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_events_action_check CHECK ((action = ANY (ARRAY['document.created'::text, 'change.proposed'::text, 'change.accepted'::text, 'change.rejected'::text, 'change.stale'::text, 'version.created'::text, 'decision.recorded'::text]))),
    CONSTRAINT audit_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'ai'::text, 'guest'::text, 'system'::text]))),
    CONSTRAINT audit_events_target_type_check CHECK ((target_type = ANY (ARRAY['document'::text, 'change'::text, 'version'::text, 'decision'::text])))
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    id uuid DEFAULT uuidv7() NOT NULL,
    document_id uuid NOT NULL,
    product_id uuid NOT NULL,
    "position" text NOT NULL COLLATE pg_catalog."C",
    type text NOT NULL,
    content jsonb NOT NULL,
    hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    removed_at timestamp with time zone,
    CONSTRAINT blocks_check CHECK (((content ->> 'type'::text) = type)),
    CONSTRAINT blocks_hash_check CHECK ((hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT blocks_position_check CHECK (("position" <> ''::text)),
    CONSTRAINT blocks_type_check CHECK ((type = ANY (ARRAY['heading'::text, 'paragraph'::text, 'bullet_item'::text, 'numbered_item'::text, 'checklist_item'::text, 'table'::text])))
);


--
-- Name: changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.changes (
    id uuid DEFAULT uuidv7() NOT NULL,
    document_id uuid NOT NULL,
    product_id uuid NOT NULL,
    op text NOT NULL,
    block_id uuid,
    anchor_block_id uuid,
    before jsonb,
    after jsonb,
    before_hash text,
    reason text NOT NULL,
    author_type text NOT NULL,
    author_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    base_version integer NOT NULL,
    resulting_version integer,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_after jsonb,
    restore_of_version integer,
    CONSTRAINT changes_accepted_add_has_block CHECK ((NOT ((op = 'add'::text) AND (status = 'accepted'::text) AND (block_id IS NULL)))),
    CONSTRAINT changes_accepted_after_shape CHECK (((accepted_after IS NULL) OR ((status = 'accepted'::text) AND (op = ANY (ARRAY['add'::text, 'edit'::text]))))),
    CONSTRAINT changes_accepted_has_version CHECK (((status = 'accepted'::text) = (resulting_version IS NOT NULL))),
    CONSTRAINT changes_author_type_check CHECK ((author_type = ANY (ARRAY['ai'::text, 'user'::text]))),
    CONSTRAINT changes_base_version_check CHECK ((base_version >= 0)),
    CONSTRAINT changes_decided_shape CHECK (((status = ANY (ARRAY['accepted'::text, 'rejected'::text])) = ((decided_by IS NOT NULL) AND (decided_at IS NOT NULL)))),
    CONSTRAINT changes_op_check CHECK ((op = ANY (ARRAY['add'::text, 'edit'::text, 'remove'::text]))),
    CONSTRAINT changes_op_shape CHECK ((((op = 'add'::text) AND (before IS NULL) AND (before_hash IS NULL) AND (after IS NOT NULL)) OR ((op = 'edit'::text) AND (block_id IS NOT NULL) AND (before IS NOT NULL) AND (before_hash IS NOT NULL) AND (after IS NOT NULL) AND (anchor_block_id IS NULL)) OR ((op = 'remove'::text) AND (block_id IS NOT NULL) AND (before IS NOT NULL) AND (before_hash IS NOT NULL) AND (after IS NULL) AND (anchor_block_id IS NULL)))),
    CONSTRAINT changes_reason_check CHECK ((btrim(reason) <> ''::text)),
    CONSTRAINT changes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'stale'::text])))
);


--
-- Name: decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decisions (
    id uuid DEFAULT uuidv7() NOT NULL,
    product_id uuid NOT NULL,
    document_id uuid NOT NULL,
    change_id uuid NOT NULL,
    version_number integer NOT NULL,
    summary text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    superseded_by uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT decisions_reason_check CHECK ((btrim(reason) <> ''::text)),
    CONSTRAINT decisions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text]))),
    CONSTRAINT decisions_summary_check CHECK ((btrim(summary) <> ''::text)),
    CONSTRAINT decisions_superseded_shape CHECK (((status = 'superseded'::text) = (superseded_by IS NOT NULL)))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT uuidv7() NOT NULL,
    product_id uuid NOT NULL,
    title text NOT NULL,
    state text DEFAULT 'draft'::text NOT NULL,
    current_version integer DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documents_current_version_check CHECK ((current_version >= 0)),
    CONSTRAINT documents_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'in_review'::text, 'final'::text]))),
    CONSTRAINT documents_title_check CHECK ((btrim(title) <> ''::text))
);


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
-- Name: versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.versions (
    id uuid DEFAULT uuidv7() NOT NULL,
    document_id uuid NOT NULL,
    product_id uuid NOT NULL,
    number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT versions_number_check CHECK ((number >= 1))
);
ALTER TABLE ONLY public.versions ALTER COLUMN snapshot SET COMPRESSION lz4;


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: blocks blocks_id_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_id_document_id_key UNIQUE (id, document_id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: changes changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_pkey PRIMARY KEY (id);


--
-- Name: decisions decisions_change_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_change_id_key UNIQUE (change_id);


--
-- Name: decisions decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_id_product_id_key UNIQUE (id, product_id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


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
-- Name: versions versions_document_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.versions
    ADD CONSTRAINT versions_document_id_number_key UNIQUE (document_id, number);


--
-- Name: versions versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.versions
    ADD CONSTRAINT versions_pkey PRIMARY KEY (id);


--
-- Name: audit_events_product_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_product_at_idx ON public.audit_events USING btree (product_id, at);


--
-- Name: blocks_live_position_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX blocks_live_position_uidx ON public.blocks USING btree (document_id, "position") WHERE (removed_at IS NULL);


--
-- Name: changes_document_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX changes_document_status_idx ON public.changes USING btree (document_id, status);


--
-- Name: changes_pending_anchor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX changes_pending_anchor_idx ON public.changes USING btree (anchor_block_id) WHERE (status = 'pending'::text);


--
-- Name: changes_pending_block_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX changes_pending_block_idx ON public.changes USING btree (block_id) WHERE (status = 'pending'::text);


--
-- Name: decisions_product_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decisions_product_status_idx ON public.decisions USING btree (product_id, status);


--
-- Name: documents_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_product_id_idx ON public.documents USING btree (product_id);


--
-- Name: memberships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id);


--
-- Name: memberships memberships_keep_at_least_one_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memberships_keep_at_least_one_owner BEFORE DELETE OR UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION app.keep_at_least_one_owner();


--
-- Name: audit_events audit_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: audit_events audit_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_document_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_document_id_product_id_fkey FOREIGN KEY (document_id, product_id) REFERENCES public.documents(id, product_id) ON DELETE CASCADE;


--
-- Name: changes changes_anchor_block_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_anchor_block_id_document_id_fkey FOREIGN KEY (anchor_block_id, document_id) REFERENCES public.blocks(id, document_id);


--
-- Name: changes changes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: changes changes_block_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_block_id_document_id_fkey FOREIGN KEY (block_id, document_id) REFERENCES public.blocks(id, document_id);


--
-- Name: changes changes_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id);


--
-- Name: changes changes_document_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_document_id_product_id_fkey FOREIGN KEY (document_id, product_id) REFERENCES public.documents(id, product_id) ON DELETE CASCADE;


--
-- Name: changes changes_restore_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.changes
    ADD CONSTRAINT changes_restore_version_fk FOREIGN KEY (document_id, restore_of_version) REFERENCES public.versions(document_id, number);


--
-- Name: decisions decisions_change_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_change_id_fkey FOREIGN KEY (change_id) REFERENCES public.changes(id);


--
-- Name: decisions decisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: decisions decisions_document_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_document_id_product_id_fkey FOREIGN KEY (document_id, product_id) REFERENCES public.documents(id, product_id) ON DELETE CASCADE;


--
-- Name: decisions decisions_document_id_version_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_document_id_version_number_fkey FOREIGN KEY (document_id, version_number) REFERENCES public.versions(document_id, number);


--
-- Name: decisions decisions_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.decisions(id);


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: documents documents_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


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
-- Name: versions versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.versions
    ADD CONSTRAINT versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: versions versions_document_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.versions
    ADD CONSTRAINT versions_document_id_product_id_fkey FOREIGN KEY (document_id, product_id) REFERENCES public.documents(id, product_id) ON DELETE CASCADE;


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events audit_events_insert_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_events_insert_members ON public.audit_events FOR INSERT TO marky_user WITH CHECK ((app.is_member(product_id) AND (actor_id = app.current_user_id()) AND (actor_type = ANY (ARRAY['user'::text, 'ai'::text]))));


--
-- Name: audit_events audit_events_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_events_select_members ON public.audit_events FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks blocks_insert_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blocks_insert_owners ON public.blocks FOR INSERT TO marky_user WITH CHECK (app.is_owner(product_id));


--
-- Name: blocks blocks_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blocks_select_members ON public.blocks FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- Name: blocks blocks_update_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blocks_update_owners ON public.blocks FOR UPDATE TO marky_user USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));


--
-- Name: changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.changes ENABLE ROW LEVEL SECURITY;

--
-- Name: changes changes_insert_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY changes_insert_owners ON public.changes FOR INSERT TO marky_user WITH CHECK ((app.is_owner(product_id) AND (author_id = app.current_user_id())));


--
-- Name: changes changes_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY changes_select_members ON public.changes FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- Name: changes changes_update_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY changes_update_owners ON public.changes FOR UPDATE TO marky_user USING (app.is_owner(product_id)) WITH CHECK ((app.is_owner(product_id) AND ((decided_by IS NULL) OR (decided_by = app.current_user_id()))));


--
-- Name: decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: decisions decisions_insert_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_insert_owners ON public.decisions FOR INSERT TO marky_user WITH CHECK ((app.is_owner(product_id) AND (created_by = app.current_user_id())));


--
-- Name: decisions decisions_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_select_members ON public.decisions FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- Name: decisions decisions_update_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_update_owners ON public.decisions FOR UPDATE TO marky_user USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));


--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_insert_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_insert_owners ON public.documents FOR INSERT TO marky_user WITH CHECK ((app.is_owner(product_id) AND (created_by = app.current_user_id())));


--
-- Name: documents documents_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_select_members ON public.documents FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- Name: documents documents_update_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_update_owners ON public.documents FOR UPDATE TO marky_user USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));


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
-- Name: versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;

--
-- Name: versions versions_insert_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY versions_insert_owners ON public.versions FOR INSERT TO marky_user WITH CHECK ((app.is_owner(product_id) AND (created_by = app.current_user_id())));


--
-- Name: versions versions_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY versions_select_members ON public.versions FOR SELECT TO marky_user USING (app.is_member(product_id));


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261109130834'),
    ('20261109130836'),
    ('20261109140145'),
    ('20261109142244');
