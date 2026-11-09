# 0023. Block content model: schema, normalisation, canonical hash, fractional keys
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (D53 block schema, D54 fractional keys, D57 text runs); neeche ki details AI ne implement karte waqt li
- Package: `modules/documents` (`@marky/documents`)

## Decision (implementation details)
| Topic | Choice | Kyun |
|---|---|---|
| Block types | heading (level 1–3), paragraph, bullet_item / numbered_item / checklist_item (`depth` 0–4), table | Lists **flat items with depth** hain, nested tree nahi: har list item apna block hai, to AI ek item ko alag se edit/comment kar sakta hai |
| Run | `{ text, marks?: ("bold"\|"italic"\|"strike"\|"code")[], link?: url }` | Link ek run property hai, mark nahi, kyunki uske saath URL chahiye |
| Link safety | Sirf `http`, `https`, `mailto` | `javascript:` URL = XSS. Validation data ke darwaze par, render par nahi |
| Table | `{ hasHeaderRow, rows: [[{ runs }]] }`, har row me barabar cells | Simple grid; merged cells MVP me nahi |
| Format constants | `HEADING_LEVELS`, `MAX_LIST_DEPTH`, `TEXT_MARKS` code constants hain, **tunables nahi** | Inhe badalna = data format badalna (migration), runtime tuning nahi |
| Normalisation | Khaali runs hatao; marks dedupe + fixed order; same-formatting wale bagal ke runs jodo | Matlab me same content = same JSON = same hash, warna AI changes bina wajah stale hote |
| Hash | SHA-256 hex of canonical JSON (sorted keys) of normalised content | DB `CHECK (hash ~ '^[0-9a-f]{64}$')` |
| Single entry point | `prepareBlock(unknown)` = validate → normalise → hash | AI, editor, sab isi darwaze se DB tak jaayenge |
| Fractional keys | `fractional-indexing@4` (rocicorp, Figma algorithm), default base-52 alphabet | Battle-tested; khud likhna learning ke liye achha par bug-prone |
| Schema ↔ DB | Compile-time guard: Zod block types == `BLOCK_TYPES` (value-lists, drift-tested) | Teeno jagah (DB CHECK, TS list, Zod) sync |

## Consequences
- Tiptap adapter (editor step) ko isi schema me convert karna hoga; list nesting = `depth`.
- Worst case me (ek hi jagah baar-baar insert) keys lambi hoti hain; order nahi tootta (test: 500 inserts).
  Zarurat padi to baad me "rebalance" job keys chhoti kar sakta hai.
- Verified (2026-11-09): 22 tests (example + `fast-check` property tests: idempotence, text preservation,
  per-character formatting, split-invariant hash, random insert order) + 2 mutation probes, jinme fast-check ne minimal
  counterexamples diye.
