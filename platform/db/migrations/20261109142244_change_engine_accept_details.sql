-- migrate:up

-- =====================================================================================================
-- Change engine: edit-then-accept (D62) aur restore batches (D61). ADR 0024.
-- =====================================================================================================

-- D62: owner ne proposal badal kar accept kiya to uska final content yahan. `after` (AI ka original) kabhi nahi badalta,
-- isliye baad me dikh sakta hai ki AI ne kya kaha aur insaan ne kya rakha.
ALTER TABLE public.changes ADD COLUMN accepted_after jsonb;

-- D61: restore se bane Changes ka batch marker: "ye version N ko wapas laane ke liye hai".
ALTER TABLE public.changes ADD COLUMN restore_of_version integer;

ALTER TABLE public.changes
  ADD CONSTRAINT changes_accepted_after_shape
    CHECK (accepted_after IS NULL OR (status = 'accepted' AND op IN ('add', 'edit'))),
  ADD CONSTRAINT changes_restore_version_fk
    FOREIGN KEY (document_id, restore_of_version) REFERENCES public.versions (document_id, number);

GRANT UPDATE (accepted_after) ON public.changes TO marky_user;


-- migrate:down

REVOKE UPDATE (accepted_after) ON public.changes FROM marky_user;
ALTER TABLE public.changes
  DROP CONSTRAINT changes_restore_version_fk,
  DROP CONSTRAINT changes_accepted_after_shape,
  DROP COLUMN restore_of_version,
  DROP COLUMN accepted_after;
