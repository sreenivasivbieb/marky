# PM Workspace (Marky): Product Design & Engineering Doc

> Ye original Google design doc (2026-11-09, author: project owner) ki repo copy hai; isme user ke baad ke faisle bhi
> laagu hain (BYOK + AI memory: ADR 0025, 0026). Ise **source of truth** maano.
> Original doc ke 3 diagrams (project lifecycle, document state/Change lifecycle, system architecture) image the aur
> copy nahi hue; unka text-wala content neeche hai. Is project ke deviations `docs/adr/` me hain. Agar yahan aur kisi ADR me
> fark ho, to **ADR jeetta hai** (wo baad ka, approved faisla hai).

## 1. Overview

PM Workspace ek cloud web app hai jahan PM rough idea se reviewed, shareable PRD tak **10 minute se kam** me pahunchta hai,
aur har change aur decision record hota hai. AI changes propose karta hai; log accept/reject karte hain; accepted decisions
product memory ban jaate hain.

- **Why:** PMs me AI adoption already high hai; asli bottleneck *decide karna* hai, banana nahi. Doc generation crowded hai
  (ChatPRD, Notion AI, Productboard Spark). Khaali jagah = team loop: review, alignment, aur "ye kyun decide hua" yaad rakhna.
- **Positioning:** "Cursor for PRDs": kaam ki unit diff aur decision hai, chat nahi.
- **First user (pehle 6 mahine):** 30–200 logon ki company me ek individual PM jo PRD likhta hai aur engineering/design sign-off chahta hai.
- **Primary success metric:** idea → structured PRD → shareable link (commentable decisions ke saath) 10 min se kam me, aur
  recipient bina account banaye useful comment chhod sake.

### Scope
| In MVP | Not in MVP |
|---|---|
| Dashboard, Workspace (chat + doc), Review screens | Design canvas / Figma competitor |
| Templates: PRD, Brief, Stakeholder Update | Two-way Jira/Linear/Figma sync |
| Per-change accept/reject, decision log, version history | RICE engines, heavy analytics |
| No-account share link with comment + approve | Real-time multi-cursor editing |
| One-way Handoff Pack export (Markdown, PDF) | Designer modes (Explore, Refine, Handoff) |

### Glossary (product)
| Term | Meaning |
|---|---|
| Product | Top container: ek product, uske docs, decisions, members |
| Document | PRD, brief ya update; blocks ki ordered list ke roop me stored |
| Change | Ek block par ek proposed edit (AI ya insaan ka); pending, accepted ya rejected |
| Decision | Accepted Change jo decision flag hua; reason aur status ke saath |
| Version | Changes accept hone par bana immutable document snapshot |
| Stakeholder link | Tokenised URL: bina account view, comment, approve |
| Handoff Pack | Export bundle: PRD, user stories, open questions, decisions |

## 2. Project lifecycle

Six phases hain, aur har phase ke end par ek gate hai. Gate numbers kaam se *pehle* tay hote hain, taaki baad me unhe mod na sakein.
Gate 0 fail ho to wedge badlo ya ruk jao. (**Deviation:** ADR 0004, Phase 0 aur MVP parallel chalenge.)

| Phase | Documents |
|---|---|
| 0. Validate | Problem brief, interview notes, validation report (go / no-go) |
| 1. Build MVP | Ye design doc, API spec, Figma file, ADRs |
| 2. Private beta | Test plan, beta feedback log, AI evaluation results |
| 3. Public launch | Launch checklist, incident runbook, pricing page, support guide |
| 4. Collaborate | Real-time editing design note, integration specs |
| 5. Scale | Capacity report, SOC 2 security policies, data processing terms |

> Original diagram me har gate ke exact numbers the; wo is copy me nahi hain. Gate criteria `docs/phase-0/` me user ke saath tay honge.

**Team documentation rules:** mehenge-se-reverse technical choices ko ADR me likho; >2 din ke change se pehle short design note
likho aur use PR me review karo; ye doc single source of truth hai aur har phase ke end par sections 4–10 dated update hote hain;
user-visible deploy ke release notes changelog me jaate hain.

## 3. Core document workflow

Document states: **Draft → In review → Final**. Document ke andar har edit ek **Change** hai, jise insaan accept, reject
ya rebase ke liye wapas bhejta hai. "Request changes" document ko wapas Draft me bhejta hai. Final document ko reopen
karne par naya version shuru hota hai aur purane approvals clear ho jaate hain.

### Modes
| Mode | Doc state | AI kya kar sakta hai | Exit |
|---|---|---|---|
| Draft | Draft | Ideas/notes/templates se Changes propose; sawal poochhna; PRD linter chalana | Owner review ke liye bheje |
| Align | In review | Comments summarise; unhe resolve karne wale Changes; stakeholder update draft | Saare listed approvers approve karein |
| Ship | Final | Final version + decisions se Handoff Pack banana | Pack exported |

### Decision lifecycle
- **Active:** jab decision-flagged Change accept ho, one-line reason aur version link ke saath.
- **Superseded:** sirf tab jab naya decision isko naam se refer kare aur reason de. Kuch delete nahi hota.
- AI har prompt me active decisions padhta hai, aur unse contradict karne wala Change propose karne se pehle warn karta hai.
- Hafte me ek baar owners ko active decisions ka digest milta hai (sirf un documents ke jo us hafte badle).

## 4. Functional requirements

MVP me 36 me se 28 requirements hain, 15 modules me. "MVP" = pehla public release.

| Module | ID | Requirement | Phase |
|---|---|---|---|
| Products | FR-01 | Product create, rename, archive; Dashboard par saare products | MVP |
| Products | FR-02 | Email se members invite, role Owner / Reviewer / Viewer | MVP |
| Editor | FR-03 | Block-based rich text (headings, lists, tables, checklists), stable block IDs | MVP |
| Editor | FR-04 | Pending changes inline: purana text struck, naya highlighted, per-block accept/reject | MVP |
| Editor | FR-05 | Ek document par ek active editor; baaki ko lock aur editor ka naam dikhe | MVP |
| Editor | FR-06 | Real-time multi-user editing | Phase 2 |
| AI chat | FR-07 | Chat panel with mode switcher: Draft, Align, Ship | MVP |
| AI chat | FR-08 | AI sirf Changes bana kar edit karta hai (document kabhi overwrite nahi) | MVP |
| AI chat | FR-09 | Slash commands: /prd, /brief, /update, /handoff | MVP |
| AI chat | FR-10 | Document, decision ya uploaded file ka @mention as context | MVP |
| AI chat | FR-11 | /prioritize (RICE) aur /flow | Phase 2 |
| Changes | FR-12 | Accept, reject, edit-then-accept; section ka bulk accept | MVP |
| Changes | FR-13 | Har Change me author, reason, before, after, time, status | MVP |
| Decisions | FR-14 | Accepted Change ko Decision mark karna, required one-line reason | MVP |
| Decisions | FR-15 | Product ka Decision Log: status filter (active, superseded), search, version link | MVP |
| Decisions | FR-16 | AI active decisions padhe, naya Change contradict kare to warn | MVP |
| Templates | FR-17 | 3 templates (PRD, Brief, Update): sections, guiding questions, failure checks | MVP |
| Templates | FR-18 | PRD linter: missing baseline metric, empty non-goals, ownerless open questions | MVP |
| Templates | FR-19 | Custom templates, team usage se seekhne wale templates | Later |
| Versions | FR-20 | Har accepted Change batch par snapshot; koi bhi version dekho; restore = naya Change set | MVP |
| Versions | FR-21 | Do versions ka side-by-side compare | MVP |
| Review | FR-22 | Review screen: last published se diff, comments, approval status, share link | MVP |
| Sharing | FR-23 | Tokenised stakeholder link: sirf naam + email se view, comment, approve | MVP |
| Sharing | FR-24 | Link settings: expiry, revoke, view-only, required approver list | MVP |
| Comments | FR-25 | Block-anchored comments, replies, resolve, @mention | MVP |
| Comments | FR-26 | AI open comments resolve karne wale Changes propose kare; insaan approve kare | MVP |
| Comments | FR-27 | Email ya Slack se comment reply | Phase 2 |
| Approvals | FR-28 | Per-document approver list; sab approve na karein tab tak Mark final disabled | MVP |
| Export | FR-29 | Handoff Pack Markdown + PDF | MVP |
| Export | FR-30 | Linear / Jira / Notion me one-way push | Phase 2 |
| Notifications | FR-31 | Email: mention, new comment, approval request, approval result | MVP |
| Notifications | FR-32 | Slack unfurl + notifications | Phase 2 |
| Context | FR-33 | Interview notes upload (txt, md, pdf) as context | MVP |
| Context | FR-34 | Figma, metrics tools, ticket systems connectors | Later |
| Account | FR-35 | Google ya email magic link sign-in | MVP |
| Account | FR-36 | SSO (SAML), audit export | Later |

### Key acceptance criteria
- Change accept karne par new version aur audit event **ek hi transaction** me banenge; ek bhi fail ho to dono save nahi honge.
- Valid link wala stakeholder 3 steps me comment kar sake: link kholo → naam + email → submit.
- Revoked/expired link par plain "link no longer valid" page aaye, aur koi content expose na ho.
- AI document seedha kabhi nahi badalta; AI service band ho tab bhi editor, comments, sharing chalte rahein.
- Purana version restore karne par naye Changes bante hain; history rewrite nahi hoti.

## 5. Non-functional requirements

MVP ke starting targets hain; pehli 50 active teams ke baad revisit karne hain. Latency = browser se p95.

| Area | ID | Requirement | Target |
|---|---|---|---|
| Performance | NFR-01 | Document open (≤50 blocks) | < 1.5 s p95 |
| Performance | NFR-02 | Change accept/reject | < 300 ms p95 |
| Performance | NFR-03 | Chat me first AI token (streaming) | < 2 s p95 |
| Performance | NFR-04 | Ek section ke liye AI Changes propose kare | < 20 s p95 |
| Performance | NFR-05 | Mid-range phone par stakeholder link first paint | < 2 s on 4G |
| Availability | NFR-06 | Core app (edit, review, share) monthly uptime | 99.9% |
| Availability | NFR-07 | Model API down ho to AI gracefully degrade | Editor + sharing usable |
| Durability | NFR-08 | Accepted content ka loss nahi | RPO 5 min, RTO 1 h |
| Durability | NFR-09 | DB point-in-time recovery | 7 din (MVP), 30 din (paid) |
| Security | NFR-10 | Encryption in transit + at rest | TLS 1.2+, AES-256 |
| Security | NFR-11 | Tenant isolation: koi query doosre product ki rows na lautaye | DB me enforced (RLS) |
| Security | NFR-12 | Share tokens | 128-bit random, hashed at rest, revocable |
| Privacy | NFR-13 | Customer content model training me use nahi | Contractual + configured |
| Privacy | NFR-14 | Request par product + saara data delete | 30 din me; backups 35 din me purge |
| Accessibility | NFR-15 | Editor + share view WCAG 2.2 AA | Keyboard-only flow chale |
| Compatibility | NFR-16 | Chrome/Safari/Edge/Firefox ke latest 2; share view ke liye mobile Safari/Chrome | Har release test |
| Observability | NFR-17 | Browser se DB tak har request ka trace ID; AI calls token counts ke saath log (debugging + user ko "kitna use hua" dikhana) | 100% requests |
| Maintainability | NFR-18 | Change engine + permissions par automated tests | ≥ 90% line coverage |
| ~~Cost~~ | ~~NFR-19~~ | **Hataya (2026-11-09, ADR 0025):** teams apni Anthropic API key laati hain (BYOK), AI ka kharcha unka hai | — |
| Scalability | NFR-20 | Section 10 ke stage targets | Section 10 |
| Security | NFR-21 | Team ki Anthropic API key (ADR 0025) | AES-256-GCM se encrypted at rest; logs, errors aur browser me kabhi nahi; sirf Owner set / replace / delete kare aur sirf masked hint (aakhri 4 characters) dekhe |

**Rules:** har API route data chhoone se pehle role + tenant check kare ("trusted internal" route koi nahi); har AI call par
timeout aur retry limit ho (spend cap hataya, ADR 0025); real-time sync wala har feature Phase 2 hai aur MVP ko block nahi karega.

## 6. System architecture

Ek web app aur ek worker PostgreSQL par chalte hain. AI layer alag module hai jise band karne se editing/review/sharing nahi tootti.
App product data ke liye Postgres aur jobs + locks ke liye Redis (**ADR 0009: Valkey**) se baat karta hai. Workers queue se jobs
padhte hain aur Postgres me read/write karte hain. Model provider ko sirf AI orchestrator call karta hai.

**Teen request flows:**
1. **AI edit:** browser chat message bhejta hai → app role + quota check karta hai → orchestrator context banakar model call karta hai →
   validated tool calls pending Changes bante hain → browser ko stream hote hain.
2. **Stakeholder comment:** share view CDN cache se load hota hai → comment app par jaata hai → rate limits + email verification →
   store → queue job owner ko email karta hai.
3. **Export:** owner export click karta hai → app job queue karta hai → worker Markdown + PDF banakar object storage me rakhta hai →
   browser ko download link milta hai.

| Decision | Choice | Reason |
|---|---|---|
| Service layout | Ek deployable app + workers (modular monolith) | Chhoti team ke liye kam moving parts; baad me module lines par split |
| Primary store | Relational ke liye PostgreSQL, blocks ke liye JSONB | Change + version + audit event ek transaction me |
| AI integration | Tool calls jo Changes banate hain | Model document overwrite nahi kar sakta; har edit reviewable |
| History | Har version ka full snapshot | Simple restore + compare; documents chhote hain |
| Concurrency | MVP me edit lock, Stage 3 me Yjs | Zaroorat se pehle real-time complexity nahi |
| Infrastructure | Managed DB, cache, storage, email | Team product banaye, operations nahi |

## 7. Technical implementation

Recommended defaults (deviations ADRs me):

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js (React) + TypeScript | App, share pages, API ek codebase me; share links ke liye server rendering |
| Editor | Tiptap (ProseMirror) | Block IDs, pending changes ke decorations, baad me Yjs |
| UI | Tailwind CSS + Radix primitives | Accessible components bina custom design system ke |
| API | Next.js route handlers + Zod | Client ke saath shared typed requests/responses |
| Database | Managed PostgreSQL + RLS | Relational, transactions, JSONB blocks |
| Cache + queue | Redis + BullMQ (**ADR 0009: Valkey**) | Rate limits, job queue, short-lived locks |
| Files | S3-compatible object storage | Uploads, exported PDFs |
| Auth | Auth.js ya Supabase Auth (**ADR 0001: Auth.js**) | Google + magic link bina password flows |
| Email | Postmark ya Resend | Transactional email, baad me inbound reply parsing |
| AI | Claude API, tool use + prompt caching | Structured edits as tool calls; repeated context sasta |
| Observability | OpenTelemetry, Sentry, structured logs | Click se query tak trace |

### Change engine (product ka core)
1. Document = blocks ki ordered list. Har block: stable ID, type, content, content hash.
2. AI kabhi rewritten document nahi lautata. Wo `propose_change(block_id, op, new_content, reason)` call karta hai; `op` = add / edit / remove.
3. Server validate karta hai: block exist karta hai, user edit kar sakta hai, base version match karta hai. Phir `pending` Change store hota hai.
4. Client editor ke andar word-level diff (diff-match-patch) dikhata hai, har Change par accept/reject.
5. Accept = ek DB transaction: block hash re-check → change apply → naya version snapshot → audit event → (flagged ho to) decision row.
6. Block hash match na kare to Change `stale` hota hai aur AI se current text par rebase karwaya jaata hai; user naya proposal dekhta hai.

### AI agent design
- **Har request me context:** template + failure checks, document outline, edit ho rahe sections, active decisions, @mentioned files.
  Poori chat history ya saare documents kabhi nahi.
- **Chat memory (ADR 0026):** chat turns document ke saath save hote hain; AI ko aakhri kuch turns + document ka **rolling summary**
  jaata hai. Chat me koi faisla dikhe ("ye Q2 me nahi karenge") to AI use **decision ke roop me save** karne ka sujhaav deta hai
  (ek click). **Decisions = memory ka sabse bada source.**
- **Modes:** Draft = Changes + sawal; Align = plus comment-resolving Changes; Ship = sirf Handoff Pack. Har mode ka alag system prompt aur tool list.
- **Permissions:** AI request shuru karne wale insaan ke rights se chalta hai. Final mark, publish, roles change ya approve nahi kar sakta.
- **Safety rails:** tool arguments JSON schema se check; invalid call drop aur ek baar retry; ek turn me max tool iterations (runaway loop se team ki key bachane ke liye).
- **Decision memory bina vector DB:** active decisions (aam taur par < 2,000 tokens) har prompt me inject. Retrieval sirf ~200+ decisions par.

### Sharing, comments, approvals
- Share link = random 128-bit token; sirf hash store. Link me scope (view / comment / approve), optional expiry, revoke flag.
- Anonymous commenter naam + email deta hai; pehla comment owner tak pahunchne se pehle email one-time code se verify. Rate limits + bot check.
- Comments block ID se jude hain, isliye edits ke baad bhi bache rehte hain.
- Approval = har approver ki har version ke liye ek row. Document badle to purane approvals `outdated`.

### Versioning aur concurrency
- Har version ka compressed full JSON snapshot. Diffs on demand.
- MVP edit lock: ek time pe ek editor, har 15 s heartbeat, 60 s idle par release. Phase 2 me Yjs.

### Export
Markdown seedha blocks se banta hai. PDF worker banata hai: headless Chromium me print view render karke object storage me.

### Core API
| Method + path | Purpose |
|---|---|
| POST /products | Product create |
| GET /documents/:id | Blocks, pending Changes, permissions |
| POST /documents/:id/chat | AI turn stream; Changes banata hai |
| POST /changes/:id/accept | Accept; version + audit event |
| POST /changes/:id/reject | Reject, optional note |
| GET /products/:id/decisions | Filters ke saath decisions |
| POST /documents/:id/share | Scope + expiry ke saath share link |
| POST /share/:token/comments | Stakeholder comment |
| POST /documents/:id/approvals | Approve / request changes |
| POST /documents/:id/export | Handoff Pack export queue |

## 8. Data model

14 core tables. Customer content wali har table me `product_id` hoga (jahan neeche nahi likha, wahan parent document se copy).
RLS isi par filter karta hai.

| Table | Key columns | Notes |
|---|---|---|
| users | id, email, name | Sign-in par banta hai |
| products | id, name, owner_id, plan | Tenant boundary |
| memberships | product_id, user_id, role | Owner, Reviewer, Viewer |
| documents | id, product_id, template_id, title, state, current_version | draft, in_review, final |
| blocks | id, document_id, position, type, content (JSONB), hash | Current draft ki live state |
| versions | id, document_id, number, snapshot (JSONB, compressed), created_by, created_at | Immutable |
| changes | id, document_id, block_id, op, before, after, reason, author_type, status, base_version | pending, accepted, rejected, stale |
| decisions | id, product_id, change_id, summary, reason, status, superseded_by | active / superseded |
| comments | id, document_id, block_id, author_ref, body, parent_id, resolved | author_ref = user ya verified guest |
| share_links | id, document_id, token_hash, scope, expires_at, revoked_at | Token khud kabhi store nahi |
| approvals | id, document_id, version_id, approver_ref, status | Naye version par outdated |
| templates | id, product_id (null = built-in), sections, checks | Versioned |
| context_files | id, product_id, name, storage_key, extracted_text | Uploaded notes |
| audit_events | id, product_id, actor_ref, action, target, at | Append-only |

**Data workflow:** Input (idea/notes; worker text extract kare) → Draft (context + model; tool calls = pending changes) →
Review (accept = blocks + versions + audit_events ek transaction; flagged → decisions) → Align (share_links; comments,
approvals; comment par email job) → Resolve (AI comment IDs se jude Changes; accept → comment resolved) → Ship (sab approvers
ne current version approve kiya → final; export) → Learn (active decisions future prompts me; superseded hata diye jaate hain).

**Data rules:** `blocks` = working draft, `versions.snapshot` = history; version kabhi edit nahi. Versions + audit events product
ki life tak; raw AI request logs (poora prompt text) 30 din baad redact (token counts rakhe); `chat_turns` aur rolling summary
document ka hissa hain, document ke saath rehte hain, redact nahi hote (ADR 0026). Product delete = 30 din soft-delete,
phir job rows + files hatata hai; backups 35 din me expire. Analytics events alag table me, document text ke bina.

## 9. Design implementation

**Principles:** (1) Diff first: AI kuch chhue to sabse pehle dikhe ki kya badla. (2) AI proposes, people decide: koi button AI
ko publish/approve/finalise nahi karne deta. (3) Stakeholders ke liye zero learning: share view me har screen ka ek kaam
(read, comment, approve). (4) Product language: "Accept change", "Mark as decision", "Request changes"; prompts/tokens/models kabhi nahi.

| Screen | Purpose | Main components |
|---|---|---|
| Dashboard | Product dhoondo, kya attention maangta hai | Product cards, pending reviews count, recent decisions |
| Workspace | AI ke saath draft | Left: chat + mode switcher + command palette. Centre: inline changes ke saath live doc. Right (collapsible): context browser + decision log |
| Review | Approval lena | Last published se diff, comments, approver status, share controls |
| Share view | Stakeholder read/comment/approve | Document, har block par comment box, Approve / Request changes, koi navigation nahi |
| Decision Log | Kyun decide hua | Status filter, search, version link |
| Settings | Members, roles, templates, link defaults | Simple forms |

**Interaction rules:** pending change me purana text struck (removed colour), naya underlined (added colour), block edge par
Accept/Reject; colour kabhi akela signal nahi (icon + label bhi). Keyboard: J/K changes ke beech, A accept, R reject,
Cmd+K palette, Cmd+Enter send. Section bulk accept ke saath 10 s undo toast. Accept par "Mark as decision" toggle, reason required.
Stale change warning + Rebase button ke saath, kabhi chupchaap drop nahi. AI streaming me text aate hi dikhe; Changes sirf poore
hone par dikhein.

**Design system:** neutral scale + ek accent + semantic (added, removed, warning, success), decorative colours nahi; ek sans-serif,
sizes 12/14/16/20/28, body 16 with 1.6 line height; 4 px grid, 8 px radius, 1 px borders, shadows sirf menus par; ~20 components;
tokens CSS variables me, light + dark ek hi tokens se.

**Har screen ke states:** empty, loading, error, offline, locked by another editor, no permission, stale change, link expired.
Har state ka chhota message hoga: kya hua aur ab kya karein.

**Accessibility/devices:** WCAG 2.2 AA (contrast ≥ 4.5:1, visible focus, labels, change accept par screen-reader announce).
Workspace desktop-first (≥1024 px); phone par read-only + comments. Share view mobile-first, reading bina JavaScript ke chale.

## 10. Scale design

Servers jodne ki jagah kaam hatao: AI calls request path se bahar, stakeholder view cache se, har write chhota (ek block,
ek Change). Ek modest deployment pehle 10,000 active PMs sambhale. Saare numbers planning assumptions hain.

**Capacity (assumptions):** 10,000 PMs × 20 AI req/day = 200k/day (~2.3/s avg, ~23/s peak at 10×). Ek shared doc par 8 stakeholders
(share views = editor traffic ka 5–10×). Doc ~50 blocks / ~40 KB → 12 GB live docs (30 docs/PM). 20 snapshots/doc @ ~10 KB → ~60 GB.
**Pehli limit model API (throughput + cost) hogi, DB nahi.**

| Stage | Load | Architecture | Aage kab badho |
|---|---|---|---|
| 1. Launch | ≤ 1,000 PMs | 1 web app, 1 worker, managed Postgres, Redis, CDN | p95 hafte bhar target se upar, ya DB CPU > 60% |
| 2. Growth | ≤ 10,000 | Web autoscale ≥3; worker pool AI/email/export queues me split; share views + Decision Log ke liye read replica; connection pooler | Share reads dominate; queue wait > 30 s |
| 3. Collaboration | ≤ 100,000 | Yjs over WebSockets (doc ID se sharded); Redis pub/sub; search index; audit_events monthly partition | Postgres write load > 50% |
| 4. Enterprise | > 100,000 | Per-region; bade customers ke dedicated schemas/DBs; SSO, audit export, data residency | Contract/regulation isolation maange |

**Bottlenecks → fixes:** model latency/cost → streaming, stable prompt prefix cache, chhote kaam chhote model par, rate
limit ke paas queue. Hot share reads → CDN par version-keyed cached snapshot, comments alag API, naye version par purge.
DB growth → indexes (document_id, position), (document_id, status), (product_id, status); audit/AI logs monthly partition;
12 mahine purane versions sasti storage me. Email volume → daily digest default; mentions + approval requests turant; retries + DLQ.
Export spikes → alag autoscaled worker pool; PDF per version cache. Retries → accept/approve/export par idempotency keys.
Noisy neighbours → per-product export rate limits; AI ki rate limit team ki apni key par lagti hai (ADR 0025).

**Reliability:** model API par timeouts + circuit breaker ("AI is unavailable", baaki sab chale); continuous backup + PITR,
quarterly restore drill; blue-green/rolling deploy with auto rollback, migrations ek release tak backward compatible;
har Phase 2 feature feature-flag ke peeche.

**Cost control:** ~~weekly AI-cost-per-PM numbers aur NFR-19 alert~~ **hataya (ADR 0025, BYOK).** Team apni key ka usage
(tokens + anumaanit cost) dekh sakti hai. Optional, baad me: team ka apna budget alert ("aaj $5 se zyada use hua").

## 11. Security, permissions, AI safety

Leaked link ya prompt-injected file ko normal event maan kar design karo, aur damage limit karo.

| Action | Owner | Reviewer | Viewer | Stakeholder link |
|---|---|---|---|---|
| Document edit + AI chalana | Yes | No | No | No |
| Changes accept/reject | Yes | No | No | No |
| Comment | Yes | Yes | Yes | Link scope allow kare to |
| Approve / request changes | Approver list me ho to | Approver list me ho to | No | Approver list me ho to |
| Mark final | Saare approvals ke baad | No | No | No |
| Share link create/revoke | Yes | No | No | No |
| Members + templates manage | Yes | No | No | No |

Fixed rules: sirf Owner publish/final kare; final ke liye har listed approver chahiye; Decision sirf naye Decision + reason se supersede.

| Threat | Control |
|---|---|
| Leaked/guessed share link | 128-bit token, hashed, expiry, instant revoke, view-only default, IP rate limit |
| Uploaded notes/comments se prompt injection | Sab data maana jaaye; AI sirf defined tools call kare; email/roles/approve nahi; har Change ko human accept |
| Cross-tenant access | Har table par RLS; doosre product ki rows padhne wale automated tests |
| Anonymous comment spam | Email OTP, rate limits, bot check, owner email block kar sake |
| Stolen session | Short-lived sessions, secure + HTTP-only cookies, member/link management par re-auth |
| Uploaded file attacks | Type/size limits, worker me virus scan, app ke domain se kabhi serve nahi |
| Insider access | Support reads ka audit log; time-limited break-glass role |
| Model provider data use | No-training setting, third-party logs me content nahi, 30 din baad AI logs redact |
| Team ki API key leak (ADR 0025) | AES-256-GCM encrypted at rest (master key env me); logs/errors/browser me kabhi nahi; sirf masked hint; sirf Owner badal sake; har badlaav audit log me |

**Compliance path:** encryption, access logs, backups, privacy policy se shuru; pehli paying team maange to SOC 2 Type I;
Stage 4 me SSO, audit export, data residency.

## 12. Delivery, metrics, testing, risks

Validation ke baad 4 logon ki team ~4 hafte me MVP bana sakti hai (full-stack lead, editor frontend, backend + AI, half-time designer).

| Metric | Definition | Starting target |
|---|---|---|
| Time to first share | New doc se pehle share link tak median minutes | < 10 |
| Activation | Pehle hafte me share link banane wale naye PMs | 40% |
| Change acceptance rate | Accepted / proposed Changes | ≥ 50% |
| Stakeholder response | 3 din me ≥1 external comment wale shared docs | 60% |
| Decision capture | Shared doc par decision-flagged accepted Changes | ≥ 2 |
| Week-4 retention | 4 hafte me doosra doc banane wale activated PMs | 30% |

**Testing:** change engine par unit + property tests (accept phir restore = original; ek block par do accept kabhi dono apply nahi);
har role × action ka permission test + cross-tenant read test jo fail hona chahiye; AI eval set (30 realistic PRD tasks: valid tool
calls, linter findings addressed, decision contradictions caught), har prompt/model change par; Playwright E2E (poora 10-min flow,
phone-size stakeholder comment ke saath); load tests (share view 100× traffic, concurrent accept); beta se pehle aur har major
release par accessibility audit.

| Risk | Effect | Mitigation |
|---|---|---|
| Doc generation crowded, incumbents AI jod rahe | Weak differentiation | Review + decisions par compete; Notion/Linear me export, replace nahi |
| PMs review loop ke liye pay nahi karenge | No revenue | Kill criteria ke saath Phase 0 validation |
| AI kharab edits propose kare | Trust loss | Har Change par human accept; eval set; har Change ka reason |
| Inline-changes editor mushkil nikle | Schedule slip | Block-level changes, single editor lock, MVP me real-time nahi |
| Anonymous links abuse/leak | Data exposure, spam | Hashed tokens, expiry, revoke, rate limits, email verification |
| Runaway AI loop team ki key ka bill badhaye (BYOK) | User ka nuksaan, trust loss | Max tool iterations per turn, prompt caching, usage view, optional budget alert |
| Decision Log graveyard ban jaaye | Feature ignored | Status + supersede, AI contradiction warnings, weekly digest |

**Open questions:** pricing (per PM seat / per product / per active document)? MVP me ek product ke ek se zyada Owner ho sakte hain?
(Recommended: haan.) Markdown/PDF ke baad pehla export kaunsa: Linear, Jira ya Notion? Designers ke modes kab aayenge?
Stage 4 se pehle kisi target customer ko data residency chahiye?
