# Marky (PM Workspace) — Working Rules for AI Agents

Ye file har AI model/agent ke liye hai jo is repo me kaam kare. **Code likhne se pehle poori file padho.**
Ye rules project owner (user) ne diye hain aur default behaviour ko override karte hain.

## 1. Ye project kya hai

- **Marky** = "PM Workspace": ek cloud web app jahan PM rough idea se reviewed, shareable PRD tak 10 minute me pahunchta hai.
  Positioning: "Cursor for PRDs" — diff aur decision hi kaam ki unit hai, chat nahi.
- **Source of truth (product + engineering design doc):** `docs/design/pm-workspace-design.md`
  Requirements (FR-xx / NFR-xx), data model, change engine, architecture sab wahan hain. Approved deviations `docs/adr/` me hain;
  design doc aur ADR me fark ho to ADR jeetta hai. Koi aur contradiction ya ambiguity mile to **rukkar user se poocho**, khud mat decide karo.
- Repo **public** hai: secrets, personal data (jaise interview notes me logon ke naam) kabhi commit nahi.
- Core idea: AI document ko kabhi seedha edit nahi karta. Wo sirf `propose_change(...)` tool call se pending **Change** banata
  hai; insaan accept/reject karta hai. Accept = ek DB transaction (block apply + version snapshot + audit event + optional decision).

## 2. Ye ek LEARNING project hai

User is project ko banate hue **seekhna** chahta hai. Isliye:

- Har naya term/methodology (jaise RLS, ADR, idempotency key, optimistic locking, modular monolith, tool use) pehli baar
  aaye to **simple Hinglish me samjhao**: kya hai, kyun use ho raha hai, alternative kya tha.
- Naye term ko `docs/learning/glossary.md` me add karo (term, 2-3 line meaning, kahan use hua).
- Koi bhi step karne se pehle batao: **kya karne ja rahe ho, kyun, aur isse kya seekhne ko milega.**
- Code ke saath "kyun aisa likha" ka chhota explanation do. Magic mat karo; step-by-step, bina jaldi ke.
- User ke saath baat **Hinglish** me karo. Code identifiers, commands, technical terms original (English) rahenge.

## 3. Decision-making rules (sabse important)

1. **Structured aur step-by-step.** Ek baar me ek step. Har step ke end par ruko, kya bana batao, user ka OK lo, tab aage badho.
2. **Har design decision user ke saath discuss hoga — implement karne se pehle.** Options, trade-offs aur apni recommendation
   do (AskUserQuestion use karo). User approve kare tab hi code likho.
3. **Doubt ho to khud decision mat lo.** Scenario user ke saamne rakho ("agar X ho to Y ya Z?") aur jawab ka wait karo.
   "Sensible default" ke naam par chupke se choice mat karo — library, schema column, naming, folder structure, sab par lagu.
4. **Approved decision ko record karo** ek ADR me (`docs/adr/NNNN-title.md`: context, decision, consequences, status),
   user ke words/reason ke saath. Design doc ki baat badalni ho (deviation) to wo bhi ADR me, user ki approval ke saath.
5. **Out-of-the-box approach pasand hai.** User creative / unconventional solutions chahta hai, standard tutorial-style nahi.
   Par har aisi idea **pehle discuss** hogi — kyun behtar hai, risk kya hai — phir implement.
6. **Scope creep nahi.** Jo maanga gaya wahi banao. Extra feature, refactor ya dependency bina poochhe mat jodo.
7. Hard-to-reverse ya outward-facing kaam (git push, deploy, DB drop, paid API calls, files delete) se pehle confirm karo.

## 4. Hardcoding aur configuration rules

**Koi hardcoded value code ke andar nahi.** Magic numbers/strings (timeouts, limits, thresholds, retry counts, role names,
status strings, model names, rate limits) ke literal logic me nahi aayenge. Values do alag jagah rahengi, aur **mix nahi hongi**:

| Category | Kya aata hai | Kahan rahega |
|---|---|---|
| **Secrets & connection settings** | passwords, API keys, tokens, DB/Redis/S3 URLs, hosts | Environment variables (`.env`, git me **kabhi nahi**; `.env.example` me sirf placeholder naam) |
| **Tunable app settings** | timeouts, heartbeat interval, retry limits, rate limits, spend caps, file-size limits, thresholds | Ek **alag, dedicated config file** (typed + validated), env/secrets se bilkul alag |
| **Fixed domain constants** | enums jaise roles, document states, change statuses | Named constants/enums ek jagah define, baaki code import kare |

- Secret ko tunable config file me ya tunable value ko `.env` me mat daalo. Dono ko mix karna rule ka violation hai.
- Config load karte waqt validate karo (galat/missing value par app start hi na ho).
- Naya tunable chahiye aur doubt hai ki wo kis category me jaata hai → user se poocho.
- Exact config file ka format/location Step 1 me user ke saath decide hoga; tab tak yahan fixed nahi hai.

## 5. Product ke non-negotiables (design doc se)

- AI sirf Changes **propose** karta hai; publish/approve/finalise/role-change kabhi nahi. AI service band ho to editor, comments,
  sharing chalte rahein.
- Accept = ek transaction (block + version + audit event [+ decision]); fail to kuch bhi save nahi.
- Versions immutable; restore naye Changes banata hai; history rewrite nahi hoti.
- Tenant isolation database (RLS) me enforce hoga; har API route role + tenant check karega.
- Share token 128-bit random, sirf hash store; revoke/expiry par content expose nahi.
- Customer content model training me use nahi hoga.

## 6. Kaam ka tareeka

- Pehle jo files/docs already hain unhe padho; wahi conventions follow karo jo user ne approve ki hain.
- Chhote, verifiable steps; har step ke baad test/check chalao aur **sach-sach** batao kya pass/fail hua.
- Git: user ke bolne par hi commit/push. Secrets kabhi commit nahi.
- Is file me naya rule jodna ho to user se approval lo, phir yahan likho.

## 7. Current status

- Folder: `~/Projects/marky`. Local git `main` branch, `origin` = https://github.com/sreenivasivbieb/marky (**public**,
  abhi khaali). Abhi tak koi commit/push nahi hua.
- Done: design doc repo me copy hua; rules likhe gaye; ADRs 0001–0014 likhe gaye (Postgres + Auth.js, pnpm, TS + Zod config,
  Docker Compose toolbox with Node 26 LTS, git + public GitHub, apps/modules/platform layout, SQL migrations + Kysely,
  Valkey, Debian trixie-slim, dbmate, design doc in repo, **Phase 0 skipped**: 0014 ne 0004 + 0012 ko supersede kiya);
  `docs/learning/glossary.md` chal raha hai.
- Machine: Docker 29 + Compose, git, gh (logged in as `sreenivasivbieb`). Host ka Node/pnpm is project ke liye use **nahi**
  hota; sab `dev` container me (ADR 0005).
- User ka editor: VS Code / Cursor.
- Step 1 ke saare foundation decisions ho gaye. Next: **Step 1a: dev environment code** (Dockerfile, docker-compose.yml,
  `./dev` wrapper, `.env.example`, pnpm workspace root). Isme ke chhote decisions (ports, wrapper commands waghera) pehle user se poochho.
- Phase 0 ka koi kaam nahi hoga (ADR 0014).
