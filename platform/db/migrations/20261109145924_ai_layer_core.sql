-- migrate:up

-- =====================================================================================================
-- AI layer core (Step 3a). ADR 0025 (BYOK key), 0026 (chat memory), 0027 (provider-agnostic, tokens only).
-- =====================================================================================================

-- ---------- Team ki AI provider key (ADR 0025, 0027) ----------
-- Key app me AES-256-GCM se encrypt hoti hai (master key env me). DB ko sirf ciphertext milta hai.
-- AAD = product_id: ek product ka ciphertext doosre product me copy karke decrypt nahi ho sakta.
CREATE TABLE public.ai_credentials (
  product_id     uuid        PRIMARY KEY REFERENCES public.products (id) ON DELETE CASCADE,
  provider       text        NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
  model          text        NOT NULL CHECK (btrim(model) <> ''),
  key_ciphertext bytea       NOT NULL,
  key_iv         bytea       NOT NULL,
  key_auth_tag   bytea       NOT NULL,
  key_version    smallint    NOT NULL DEFAULT 1 CHECK (key_version >= 1),   -- master key rotation ke liye
  key_hint       text        NOT NULL CHECK (char_length(key_hint) BETWEEN 1 AND 8),  -- jaise "…a1b2"
  updated_by     uuid        NOT NULL REFERENCES public.users (id),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- Chat (ADR 0026): document ka hissa, redact nahi hota ----------
CREATE TABLE public.chat_turns (
  id                    uuid        PRIMARY KEY DEFAULT uuidv7(),
  document_id           uuid        NOT NULL,
  product_id            uuid        NOT NULL,
  role                  text        NOT NULL CHECK (role IN ('user', 'assistant')),
  mode                  text        NOT NULL CHECK (mode IN ('draft', 'align', 'ship')),
  author_id             uuid        NOT NULL REFERENCES public.users (id),  -- assistant turn: jis user ne AI chalaya
  content               text        NOT NULL,
  decision_suggestions  jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- AI ke `suggest_decision` sujhaav (sirf assistant)
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, document_id),
  FOREIGN KEY (document_id, product_id) REFERENCES public.documents (id, product_id) ON DELETE CASCADE,
  CONSTRAINT chat_turns_suggestions_shape CHECK (
    jsonb_typeof(decision_suggestions) = 'array' AND (role = 'assistant' OR decision_suggestions = '[]'::jsonb)
  )
);
CREATE INDEX chat_turns_document_idx ON public.chat_turns (document_id, id);

-- Rolling summary (ADR 0026): "is doc me ab tak kya discuss hua", aur kaunse turn tak summarise hua.
ALTER TABLE public.documents
  ADD COLUMN chat_summary         text NOT NULL DEFAULT '',
  ADD COLUMN chat_summary_through uuid,
  ADD CONSTRAINT documents_chat_summary_through_fk
    FOREIGN KEY (chat_summary_through, id) REFERENCES public.chat_turns (id, document_id);

-- AI ke Changes kis user message se aaye (chat ↔ changes ka link)
ALTER TABLE public.changes
  ADD COLUMN chat_turn_id uuid,
  ADD CONSTRAINT changes_chat_turn_fk FOREIGN KEY (chat_turn_id, document_id) REFERENCES public.chat_turns (id, document_id);

-- Chat se bhi decision ban sakta hai (ADR 0026): ya to Change se, ya chat turn se. Dono ek saath nahi, koi nahi bhi nahi.
ALTER TABLE public.decisions
  ALTER COLUMN change_id DROP NOT NULL,
  ADD COLUMN chat_turn_id uuid,
  ADD CONSTRAINT decisions_chat_turn_fk FOREIGN KEY (chat_turn_id, document_id) REFERENCES public.chat_turns (id, document_id),
  ADD CONSTRAINT decisions_one_source CHECK ((change_id IS NULL) <> (chat_turn_id IS NULL));

-- ---------- Usage ledger (NFR-17, ADR 0025/0027): tokens only ----------
CREATE TABLE public.ai_requests (
  id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id         uuid        NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  document_id        uuid,
  user_id            uuid        NOT NULL REFERENCES public.users (id),
  purpose            text        NOT NULL CHECK (purpose IN ('chat', 'summary', 'connection_test')),
  provider           text        NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
  model              text        NOT NULL,
  status             text        NOT NULL CHECK (status IN ('succeeded', 'failed', 'refused')),
  stop_reason        text,       -- provider ka apna raw stop reason (debug)
  error_code         text,       -- hamari classification (timeout, auth, rate_limit, …); key/message kabhi nahi
  input_tokens       integer     NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens      integer     NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cache_read_tokens  integer     CHECK (cache_read_tokens >= 0),    -- NULL = provider ne nahi bataya
  cache_write_tokens integer     CHECK (cache_write_tokens >= 0),
  duration_ms        integer     NOT NULL CHECK (duration_ms >= 0),
  request_payload    jsonb,      -- raw prompt (debug). 30 din baad redact (ADR 0026). API key kabhi nahi.
  response_payload   jsonb,
  redacted_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, product_id) REFERENCES public.documents (id, product_id) ON DELETE CASCADE,
  CONSTRAINT ai_requests_redacted_shape CHECK (
    redacted_at IS NULL OR (request_payload IS NULL AND response_payload IS NULL)
  )
);
CREATE INDEX ai_requests_product_created_idx ON public.ai_requests (product_id, created_at);  -- usage view
CREATE INDEX ai_requests_redaction_idx ON public.ai_requests (created_at) WHERE redacted_at IS NULL;

-- ---------- Audit: naye actions/targets ----------
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
  'document.created', 'change.proposed', 'change.accepted', 'change.rejected', 'change.stale', 'version.created',
  'decision.recorded', 'ai_credential.set', 'ai_credential.removed'));
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_target_type_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_target_type_check CHECK (target_type IN (
  'document', 'change', 'version', 'decision', 'ai_credential'));

-- =====================================================================================================
-- RLS + GRANTs
-- =====================================================================================================
ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_turns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests    ENABLE ROW LEVEL SECURITY;

-- ai_credentials: sirf Owner (design doc section 11 + user ka rule). Ciphertext columns ka SELECT GRANT kisi ko NAHI:
-- app ki koi galat query (ya API bug) bhi encrypted key tak nahi pahunch sakti. Decrypt ke liye neeche wala function.
GRANT SELECT (product_id, provider, model, key_hint, key_version, updated_by, updated_at),
      INSERT,
      UPDATE (provider, model, key_ciphertext, key_iv, key_auth_tag, key_version, key_hint, updated_by, updated_at),
      DELETE
  ON public.ai_credentials TO marky_user;
CREATE POLICY ai_credentials_owners ON public.ai_credentials FOR ALL TO marky_user
  USING (app.is_owner(product_id))
  WITH CHECK (app.is_owner(product_id) AND updated_by = app.current_user_id());

-- Encrypted key sirf us product ke Owner ko, aur sirf server-side decrypt ke liye (ADR 0025).
CREATE FUNCTION app.ai_credential_secret(p_product_id uuid)
RETURNS TABLE (provider text, model text, key_ciphertext bytea, key_iv bytea, key_auth_tag bytea, key_version smallint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.provider, c.model, c.key_ciphertext, c.key_iv, c.key_auth_tag, c.key_version
  FROM public.ai_credentials AS c
  WHERE c.product_id = p_product_id
    AND app.is_owner(p_product_id)
$$;
GRANT EXECUTE ON FUNCTION app.ai_credential_secret(uuid) TO marky_user;

-- chat_turns: members padhte; owner likhta (AI chalana owner-only). Append-only: UPDATE/DELETE GRANT nahi.
GRANT SELECT, INSERT ON public.chat_turns TO marky_user;
CREATE POLICY chat_turns_select_members ON public.chat_turns FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY chat_turns_insert_owners ON public.chat_turns FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id) AND author_id = app.current_user_id());

-- documents: rolling summary owner update karta hai (documents_update_owners policy pehle se hai)
GRANT UPDATE (chat_summary, chat_summary_through) ON public.documents TO marky_user;

-- ai_requests: members apna/team ka usage dekh sakte; row hamesha current user ke naam se. Redaction system job (admin).
GRANT SELECT, INSERT ON public.ai_requests TO marky_user;
CREATE POLICY ai_requests_select_members ON public.ai_requests FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY ai_requests_insert_members ON public.ai_requests FOR INSERT TO marky_user
  WITH CHECK (app.is_member(product_id) AND user_id = app.current_user_id());


-- migrate:down

REVOKE UPDATE (chat_summary, chat_summary_through) ON public.documents FROM marky_user;
DROP FUNCTION app.ai_credential_secret(uuid);
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_target_type_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_target_type_check CHECK (target_type IN (
  'document', 'change', 'version', 'decision'));
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
  'document.created', 'change.proposed', 'change.accepted', 'change.rejected', 'change.stale', 'version.created',
  'decision.recorded'));
DROP TABLE public.ai_requests;
ALTER TABLE public.decisions
  DROP CONSTRAINT decisions_one_source,
  DROP CONSTRAINT decisions_chat_turn_fk,
  DROP COLUMN chat_turn_id,
  ALTER COLUMN change_id SET NOT NULL;
ALTER TABLE public.changes DROP CONSTRAINT changes_chat_turn_fk, DROP COLUMN chat_turn_id;
ALTER TABLE public.documents
  DROP CONSTRAINT documents_chat_summary_through_fk,
  DROP COLUMN chat_summary_through,
  DROP COLUMN chat_summary;
DROP TABLE public.ai_credentials;
DROP TABLE public.chat_turns;
