-- migrate:up

-- =====================================================================================================
-- Change engine core (Step 2a): documents, blocks, changes, versions, decisions, audit_events.
-- Faisle: D53–D60 (block schema, fractional positions, TS engine, human edits = auto-accepted Changes,
-- text runs, eager stale, ye scope, har accept = 1 version). Design doc section 7 "change engine", section 8.
--
-- Naye patterns (pehli baar):
--   * product_id har table me copy hota hai (RLS ke liye), aur COMPOSITE FOREIGN KEY
--     (document_id, product_id) -> documents(id, product_id) guarantee karta hai ki copy hamesha sahi ho.
--     Warna koi bug ek block ko document A me aur product B me daal sakta tha, aur RLS galat product se filter karta.
--   * Blocks kabhi hard-delete nahi hote: `removed_at` (soft delete). Comments, purane Changes aur versions block ID
--     se jude rehte hain, aur restore ke time wahi ID wapas mil sakta hai.
--   * `position` = fractional index key, `COLLATE "C"` ke saath (byte order). DB ka default en_US collation case
--     ignore karke sort karta hai ('a1' < 'B1'), jo fractional keys ka order tod deta.
-- =====================================================================================================

CREATE TABLE public.documents (
  id              uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id      uuid        NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  title           text        NOT NULL CHECK (btrim(title) <> ''),
  state           text        NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'in_review', 'final')),
  current_version integer     NOT NULL DEFAULT 0 CHECK (current_version >= 0),   -- 0 = abhi koi version nahi
  created_by      uuid        NOT NULL REFERENCES public.users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, product_id)     -- composite FKs isi ko point karte hain
);
CREATE INDEX documents_product_id_idx ON public.documents (product_id);

CREATE TABLE public.blocks (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  document_id uuid        NOT NULL,
  product_id  uuid        NOT NULL,
  position    text        COLLATE "C" NOT NULL CHECK (position <> ''),
  type        text        NOT NULL CHECK (type IN ('heading', 'paragraph', 'bullet_item', 'numbered_item',
                                                    'checklist_item', 'table')),
  content     jsonb       NOT NULL CHECK (content ->> 'type' = type),   -- content ka type column se match kare
  hash        text        NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),      -- sha256(canonical content), TS banata hai
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,                                               -- soft delete (NULL = live)
  UNIQUE (id, document_id),                                              -- changes ka composite FK
  FOREIGN KEY (document_id, product_id) REFERENCES public.documents (id, product_id) ON DELETE CASCADE
);
-- Ek document me do LIVE blocks ki same position nahi ho sakti. Partial index: removed blocks is rule se bahar.
-- Ye index "document ke blocks order me" query ko bhi fast karta hai (design doc section 10: (document_id, position)).
CREATE UNIQUE INDEX blocks_live_position_uidx ON public.blocks (document_id, position) WHERE removed_at IS NULL;

CREATE TABLE public.changes (
  id                uuid        PRIMARY KEY DEFAULT uuidv7(),
  document_id       uuid        NOT NULL,
  product_id        uuid        NOT NULL,
  op                text        NOT NULL CHECK (op IN ('add', 'edit', 'remove')),
  block_id          uuid,       -- edit/remove: target block. add: accept par naye block ka id yahan aata hai
  anchor_block_id   uuid,       -- sirf add: is block ke BAAD daalo (NULL = document ki shuruaat)
  before            jsonb,      -- proposal ke waqt block ka content (add me NULL)
  after             jsonb,      -- naya content (remove me NULL)
  before_hash       text,       -- proposal ke waqt block ka hash; accept par match na kare to stale
  reason            text        NOT NULL CHECK (btrim(reason) <> ''),     -- FR-13: har Change ka reason
  author_type       text        NOT NULL CHECK (author_type IN ('ai', 'user')),
  author_id         uuid        NOT NULL REFERENCES public.users (id),   -- jisne edit kiya, ya AI se karwaya
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'rejected', 'stale')),
  base_version      integer     NOT NULL CHECK (base_version >= 0),     -- proposal ke waqt document ka version
  resulting_version integer,    -- accept hua to kaunsa version bana
  decided_by        uuid        REFERENCES public.users (id),
  decided_at        timestamptz,
  decision_note     text,       -- reject ka optional note (FR-12)
  created_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, product_id) REFERENCES public.documents (id, product_id) ON DELETE CASCADE,
  FOREIGN KEY (block_id, document_id) REFERENCES public.blocks (id, document_id),
  FOREIGN KEY (anchor_block_id, document_id) REFERENCES public.blocks (id, document_id),
  -- Har op ka "shape" DB khud enforce karta hai, to koi adhoora Change save hi nahi ho sakta.
  CONSTRAINT changes_op_shape CHECK (
       (op = 'add'    AND before IS NULL     AND before_hash IS NULL     AND after IS NOT NULL)
    OR (op = 'edit'   AND block_id IS NOT NULL AND before IS NOT NULL AND before_hash IS NOT NULL AND after IS NOT NULL
                      AND anchor_block_id IS NULL)
    OR (op = 'remove' AND block_id IS NOT NULL AND before IS NOT NULL AND before_hash IS NOT NULL AND after IS NULL
                      AND anchor_block_id IS NULL)
  ),
  -- accepted/rejected = kisi insaan ne decide kiya; pending/stale = abhi kisi ne nahi.
  CONSTRAINT changes_decided_shape CHECK (
    (status IN ('accepted', 'rejected')) = (decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CONSTRAINT changes_accepted_has_version CHECK ((status = 'accepted') = (resulting_version IS NOT NULL)),
  CONSTRAINT changes_accepted_add_has_block CHECK (NOT (op = 'add' AND status = 'accepted' AND block_id IS NULL))
);
CREATE INDEX changes_document_status_idx ON public.changes (document_id, status);   -- design doc section 10
CREATE INDEX changes_pending_block_idx ON public.changes (block_id) WHERE status = 'pending';          -- eager stale
CREATE INDEX changes_pending_anchor_idx ON public.changes (anchor_block_id) WHERE status = 'pending';

CREATE TABLE public.versions (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  document_id uuid        NOT NULL,
  product_id  uuid        NOT NULL,
  number      integer     NOT NULL CHECK (number >= 1),
  snapshot    jsonb       NOT NULL,     -- { title, blocks: [{ id, position, type, content }] }, immutable
  created_by  uuid        NOT NULL REFERENCES public.users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, number),
  FOREIGN KEY (document_id, product_id) REFERENCES public.documents (id, product_id) ON DELETE CASCADE
);
-- Bade values Postgres apne aap compress karta hai (TOAST). lz4 default pglz se kaafi fast hai. (Design doc: "compressed")
ALTER TABLE public.versions ALTER COLUMN snapshot SET COMPRESSION lz4;

CREATE TABLE public.decisions (
  id             uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id     uuid        NOT NULL,
  document_id    uuid        NOT NULL,
  change_id      uuid        NOT NULL UNIQUE REFERENCES public.changes (id),  -- ek Change = max ek Decision
  version_number integer     NOT NULL,
  summary        text        NOT NULL CHECK (btrim(summary) <> ''),
  reason         text        NOT NULL CHECK (btrim(reason) <> ''),            -- FR-14: reason required
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  superseded_by  uuid        REFERENCES public.decisions (id),
  created_by     uuid        NOT NULL REFERENCES public.users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, product_id) REFERENCES public.documents (id, product_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id, version_number) REFERENCES public.versions (document_id, number),
  CONSTRAINT decisions_superseded_shape CHECK ((status = 'superseded') = (superseded_by IS NOT NULL))
);
CREATE INDEX decisions_product_status_idx ON public.decisions (product_id, status);  -- design doc section 10

CREATE TABLE public.audit_events (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id  uuid        NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  actor_type  text        NOT NULL CHECK (actor_type IN ('user', 'ai', 'guest', 'system')),
  actor_id    uuid        REFERENCES public.users (id),   -- ai = jis user ne AI chalaya; system/guest = NULL
  action      text        NOT NULL CHECK (action IN ('document.created', 'change.proposed', 'change.accepted',
                                                     'change.rejected', 'change.stale', 'version.created',
                                                     'decision.recorded')),
  target_type text        NOT NULL CHECK (target_type IN ('document', 'change', 'version', 'decision')),
  target_id   uuid        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_product_at_idx ON public.audit_events (product_id, at);

-- =====================================================================================================
-- RLS + GRANTs. Design doc section 11: sirf Owner edit/AI/accept/reject karta hai; Reviewer + Viewer padhte hain.
-- (Comments, approvals waghera apne steps me; tab reviewer/guest ke rights badhenge.)
-- DELETE ka GRANT kisi table par nahi: history kabhi nahi mitti. Blocks soft-delete hote hain.
-- =====================================================================================================

ALTER TABLE public.documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- documents
GRANT SELECT, INSERT, UPDATE (title, state, current_version) ON public.documents TO marky_user;
CREATE POLICY documents_select_members ON public.documents FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY documents_insert_owners ON public.documents FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id) AND created_by = app.current_user_id());
CREATE POLICY documents_update_owners ON public.documents FOR UPDATE TO marky_user
  USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));

-- blocks (sirf engine likhta hai; owner ke rights se)
GRANT SELECT, INSERT, UPDATE (position, type, content, hash, updated_at, removed_at) ON public.blocks TO marky_user;
CREATE POLICY blocks_select_members ON public.blocks FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY blocks_insert_owners ON public.blocks FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id));
CREATE POLICY blocks_update_owners ON public.blocks FOR UPDATE TO marky_user
  USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));

-- changes: author hamesha current user (AI bhi user ke naam se chalta hai, design doc section 7 "Permissions")
GRANT SELECT, INSERT,
      UPDATE (status, block_id, resulting_version, decided_by, decided_at, decision_note)
  ON public.changes TO marky_user;
CREATE POLICY changes_select_members ON public.changes FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY changes_insert_owners ON public.changes FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id) AND author_id = app.current_user_id());
CREATE POLICY changes_update_owners ON public.changes FOR UPDATE TO marky_user
  USING (app.is_owner(product_id))
  WITH CHECK (app.is_owner(product_id) AND (decided_by IS NULL OR decided_by = app.current_user_id()));

-- versions: immutable (sirf INSERT; UPDATE ka GRANT hi nahi)
GRANT SELECT, INSERT ON public.versions TO marky_user;
CREATE POLICY versions_select_members ON public.versions FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY versions_insert_owners ON public.versions FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id) AND created_by = app.current_user_id());

-- decisions: supersede ke liye sirf status/superseded_by badal sakte hain (Decisions step)
GRANT SELECT, INSERT, UPDATE (status, superseded_by) ON public.decisions TO marky_user;
CREATE POLICY decisions_select_members ON public.decisions FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY decisions_insert_owners ON public.decisions FOR INSERT TO marky_user
  WITH CHECK (app.is_owner(product_id) AND created_by = app.current_user_id());
CREATE POLICY decisions_update_owners ON public.decisions FOR UPDATE TO marky_user
  USING (app.is_owner(product_id)) WITH CHECK (app.is_owner(product_id));

-- audit_events: append-only (INSERT + SELECT; UPDATE/DELETE ka GRANT nahi). Actor hamesha current user.
GRANT SELECT, INSERT ON public.audit_events TO marky_user;
CREATE POLICY audit_events_select_members ON public.audit_events FOR SELECT TO marky_user
  USING (app.is_member(product_id));
CREATE POLICY audit_events_insert_members ON public.audit_events FOR INSERT TO marky_user
  WITH CHECK (app.is_member(product_id) AND actor_id = app.current_user_id() AND actor_type IN ('user', 'ai'));


-- migrate:down

DROP TABLE public.audit_events;
DROP TABLE public.decisions;
DROP TABLE public.versions;
DROP TABLE public.changes;
DROP TABLE public.blocks;
DROP TABLE public.documents;
