# 0022. Change engine design (schema + model)
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (D53–D60; AI ne options aur recommendations di), kuch implementation choices AI ne liye (neeche alag)
- Implements: design doc section 3, 7 ("change engine"), 8; FR-03, FR-04, FR-12, FR-13, FR-14, FR-20

## User ke faisle
| # | Topic | Faisla | Kyun |
|---|---|---|---|
| D53 | Block format | Apna chhota typed schema: heading, paragraph, bullet_item, numbered_item, checklist_item, table | AI, diff, export ke liye simple; editor (Tiptap) ke liye adapter |
| D57 | Inline formatting | **Text runs**: `runs: [{ text, marks? }]` | Text badalne par offsets nahi tootte; plain text = runs jodo |
| D54 | Order | **Fractional index keys** (`position text COLLATE "C"`) | Beech me insert = 1 row; renumbering kabhi nahi; Yjs-friendly |
| D55 | Engine logic | **TypeScript** (`modules/changes`) + Kysely transaction (`withActor`) | Unit/property tests aasaan; RLS + constraints safety net |
| D56 | Human edits | **Auto-accepted Change per block** (debounced) | Ek pipeline, poori history; AI changes `pending` se shuru |
| D58 | Stale | **Eager** (block badalte hi usi transaction me) + accept par hash re-check | UI turant "Rebase" dikhaye; race nahi chhootti |
| D59 | Scope | documents, blocks, changes, versions, decisions, audit_events | Accept transaction decision row bhi likhti hai |
| D60 | Versions | **Har accept transaction = 1 version** (full snapshot) | Kisi bhi point par restore/compare |

## Implementation choices (AI ne liye, user review ke liye `DECISIONS.md` me listed)
- **Composite FKs** `(document_id, product_id) → documents(id, product_id)`: copied `product_id` kabhi galat nahi ho sakta,
  isliye RLS hamesha sahi product se filter karta hai. Changes ke `block_id`/`anchor_block_id` bhi `(…, document_id)` se
  bandhe hain, to koi Change doosre document ka block target nahi kar sakta.
- **Blocks soft-delete** (`removed_at`), hard delete nahi. Comments, Changes, versions block ID se jude rehte hain.
  Live position uniqueness ke liye partial unique index `WHERE removed_at IS NULL`.
- **`add` op ka anchor model:** `anchor_block_id` = "is block ke baad" (NULL = shuruaat). Asli fractional key **accept ke
  waqt** nikalti hai (proposal ke waqt ke neighbours tab tak badal chuke ho sakte hain). Accept ke baad naye block ka id
  `changes.block_id` me aata hai.
- **Op shape DB me enforced** (`changes_op_shape`): add = sirf after; edit = before + before_hash + after; remove = before +
  before_hash. Decided/accepted fields ke bhi shape constraints hain.
- **Snapshot compression:** `versions.snapshot` par `lz4` (Postgres TOAST). Design doc ka "compressed" isi se pura hota hai.
- **Template link abhi nahi:** `documents.template_id` Templates step me aayega.
- **Audit:** append-only (sirf INSERT + SELECT GRANT); actor hamesha current user; actions ek value list me (drift test).
- **Permissions (design doc section 11):** sirf Owner documents/blocks/changes/versions/decisions likhta hai; Reviewer +
  Viewer padhte hain; kisi table par DELETE GRANT nahi.

## Consequences
- Engine (Step 2c) ko har accept me document row lock (`FOR UPDATE`) karna hoga, taaki do accepts ek saath version
  number na takrayein.
- Restore (FR-20) aur edit-then-accept (FR-12) ka exact behaviour engine step me design hoga.
- Verified (2026-11-09): 11 schema tests (cross-tenant, reviewer read-only, forged created_by/actor, composite FK,
  collation order, live-position uniqueness, op shape, cross-document target, versions/audit immutability) +
  collation mutation probe.
