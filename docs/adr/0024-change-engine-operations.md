# 0024. Change engine operations (`@marky/changes`)
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (D61 restore, D62 edit-then-accept, D63 bulk + stale; pehle ke D55, D56, D58, D60); baaki details AI ne li
- Builds on: ADR 0022 (schema), 0023 (block model)

## User ke faisle
| # | Faisla |
|---|---|
| D61 | Restore = **pending** Change set (`changes.restore_of_version`); owner diff dekh kar accept kare |
| D62 | Edit-then-accept: AI ka `after` waisa hi; owner ka final content `changes.accepted_after` me |
| D63 | Bulk accept: valid Changes apply (ek version), stale alag mark + result me report |

## API (har function caller ki transaction leta hai, `withActor` ke andar)
| Function | Kya karta hai |
|---|---|
| `createDocument` | document + blocks (`keysBetween`) + version 1 + audit. Shuruaati content Changes ke bina |
| `proposeChange` | pending Change (`edit` / `remove` / `add` with anchor). Content `prepareBlock` se validate |
| `acceptChanges` | doc LOCK → har Change (id order) hash check → apply / stale → eager stale → 1 version → audit → decisions |
| `rejectChange` | pending **ya stale** → rejected (+ optional note) |
| `saveHumanEdit` | lock → propose (`author_type: user`) → accept, ek transaction me (D56) |
| `proposeRestore` | current vs snapshot diff → removes, edits, revives (same block ids) as pending Changes |

## Implementation choices (AI ne liye; `DECISIONS.md` me listed)
- **Pessimistic lock:** accept/human-edit document row par `SELECT … FOR UPDATE` lete hain; version number collision nahi.
- **Accept order = banne ka order** (`ORDER BY id`, UUIDv7), input ka order nahi. Restore isi par tika hai.
- **Stale reasons:** `block_changed`, `block_removed`, `anchor_removed`, `block_already_live`, `already_stale`.
- **State rule:** propose/accept sirf `draft` aur `in_review` me; `final` me `document_final`.
- **Non-owner** ko `document_not_found` milta hai (RLS: FOR UPDATE ko UPDATE policy pass karni padti hai). Ye "forbidden"
  nahi kehta, to doosre product ke documents ka hona bhi pata nahi chalta.
- **Restore:** title restore nahi karta (title edits Changes nahi hain). Revives anchor-group me ulte order me bante hain.
  Surviving blocks ka order kabhi nahi badalta, kyunki MVP me "move" op nahi hai.
- Human edit ka reason: `"Edited by owner"` (product language).

## Consequences
- Verified (2026-11-09): 19 engine tests, jinme design doc ke dono khaas tests hain (restore round-trip **property test**,
  25 random scenarios asli DB par; "two accepts on one block never both apply"), aur 3 mutation probes.
  Probe 1 se dikha ki "two accepts" ko do parten bachati hain (eager stale + accept-time hash check).
- **Abhi test nahi hua:** do *alag* connections se ek saath accept (asli concurrency). Iske liye committed seed data
  chahiye, jo rollback-per-test strategy (ADR 0020) se mel nahi khaata. Follow-up.
- Idempotency keys (design doc section 10) API layer ke saath aayenge.
