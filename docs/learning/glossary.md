# Glossary (seekhne ke liye)

Har naya term jo project me aata hai, yahan simple bhasha me. Format: **Term**: matlab. *Kahan use hua.*

## Process / methodology
- **ADR (Architecture Decision Record)**: ek page ka note jo bataata hai ki koi bada technical faisla kyun liya.
  *docs/adr/*
- **Phase / Gate**: project ke stages. Gate ek checkpoint hai jahan pass/fail ka number pehle se tay hota hai, taaki baad me
  apni suvidha ke hisaab se goalpost na khiska sakein. *Design doc section 2, ADR 0004*
- **Validation (Phase 0)**: code likhne se pehle check karna ki problem asli hai aur log paise denge. *ADR 0004*
- **Kill criteria**: pehle se tay kiye gaye numbers. Validation me ye na mile to project rok do ya direction badlo.
  Pehle tay karne se baad me khud ko dhokha dena mushkil hota hai. *ADR 0012*
- **Source of truth**: wo ek jagah jise sahi maana jaata hai. Do jagah fark ho to yahi jeetegi. *ADR 0013*
- **Deviation**: design doc se jaan-boojh kar hatna. Hamesha ADR me record hota hai. *ADR 0004*
- **Fail fast**: galti ho to turant aur zor se fail karo (jaise app start na ho), chupchaap galat chalte mat raho. *ADR 0003*

## Database / backend
- **PostgreSQL (Postgres)**: open-source relational database. Tables, SQL, transactions. *ADR 0001*
- **Transaction**: kai DB operations jo "sab ya kuch nahi" ki tarah chalte hain. Ek bhi fail ho to sab undo (rollback).
  *Change accept = block + version + audit event*
- **Tenant**: ek customer ka alag data-ghar. Marky me tenant boundary = `product`. *Design doc section 8*
- **RLS (Row-Level Security)**: Postgres feature jisme DB khud har query par filter lagata hai ("sirf is product ki rows").
  App code me bug ho tab bhi doosre tenant ka data leak nahi hota. *NFR-11, ADR 0001*
- **Migration**: database schema ka versioned change (jaise "table X banao", "column Y jodo"), jo code ki tarah git me rehta hai. *ADR 0008*
- **Migration runner (dbmate)**: tool jo migration files ko order me chalata hai aur DB ki ek table (`schema_migrations`)
  me yaad rakhta hai ki kaunsi chal chuki hain. *ADR 0011*
- **Up / down migration**: `up` = change lagao, `down` = wahi change ulta karo (rollback). *ADR 0011*
- **RLS policy (`USING` / `WITH CHECK`)**: `USING` = kaunsi purani rows dikh/badal sakti hain; `WITH CHECK` = nayi ya
  badli hui row allowed hai ya nahi. Policy se bahar ki rows par UPDATE/DELETE error nahi deta, bas "0 rows". *tenancy_core migration*
- **GRANT vs POLICY (defense in depth)**: GRANT = kaunsi table/column; POLICY = kaunsi rows. Ek parat toote to doosri
  bachati hai (mutation probe me dikha). *ADR 0018*
- **DB role / `SET ROLE` / NOINHERIT**: Postgres me role = user ya group. `SET ROLE` se kisi aur role ke rights le lete ho.
  NOINHERIT = member hone ke bawajood rights apne aap nahi milte, `SET ROLE` karna padta hai. *ADR 0018*
- **`SET LOCAL` / `set_config(..., true)`**: setting sirf current transaction tak. Commit/rollback par mit jaati hai,
  isliye pooled connection par leak nahi hoti. *actor.ts*
- **Actor / claim**: "request kaun kar raha hai" ki info, jo DB ko JSON me di jaati hai. *ADR 0018*
- **SECURITY DEFINER**: function apne owner ke rights se chalta hai, caller ke nahi. Powerful aur khatarnaak hai, isliye
  `search_path = ''` aur chhota, focused logic. *tenancy_core migration*
- **`search_path`**: Postgres bina schema ke naam (`users`) ko kin schemas me dhoondhe. Khaali rakhne se koi fake table
  beech me nahi ghus sakti. *migrations*
- **Least privilege**: har role ko sirf utna access jitna zaroori ho, usse zyada nahi (`REVOKE ... FROM PUBLIC`). *ADR 0018*
- **Fail closed**: kuch missing ho (jaise actor) to "sab band", "sab khula" nahi. *rls.test.ts*
- **UUIDv7**: time-ordered UUID. Shuru ke bits time hain, to naye IDs index ke end me judte hain (fast), par phir bhi
  guess nahi hote. *ADR 0019*
- **CHECK constraint**: column par rule (jaise role sirf 3 values). DB khud enforce karta hai. *ADR 0019*
- **Invariant**: aisa rule jo hamesha sach rehna chahiye ("har product me kam se kam ek owner"). *ADR 0019*
- **Trigger**: INSERT/UPDATE/DELETE par apne aap chalne wala function. *keep_at_least_one_owner*
- **Race condition / row lock (`FOR UPDATE`)**: do requests ek saath chalein to dono check pass karke galat state bana sakti
  hain. Lock se wo ek-ek karke chalti hain. *keep_at_least_one_owner*
- **Idempotent**: kitni baar bhi chalao, result same (`IF NOT EXISTS`, `./dev db bootstrap`). *roles migration*
- **SQLSTATE error code**: Postgres ka 5-character error code (`42501` permission, `23514` check, `42P01` table nahi mili). *testing/db.ts*
- **SAVEPOINT**: transaction ke beech ek checkpoint. Error ke baad sirf wahin tak rollback, poora transaction nahi. *expectDbError*
- **Integration test**: asli DB/service ke saath test (unit test me sab fake hota hai). *rls.test.ts*
- **Mutation probe**: code/DB me jaan-boojh kar bug daalo (jaise RLS off) aur dekho ki tests fail hote hain ya nahi.
  Isse pata chalta hai ki tests sach me kuch check kar rahe hain. *Step 1c*
- **Composite foreign key**: do columns milkar doosri table ke do columns ko point karein (`(document_id, product_id)`).
  Isse copy kiya hua `product_id` kabhi galat nahi ho sakta. *ADR 0022*
- **Denormalisation**: ek value (product_id) ko kai tables me copy karna, taaki query/RLS fast aur simple ho. Iska risk
  inconsistency hai, jiska ilaaj composite FK hai. *ADR 0022*
- **Soft delete**: row mitaane ki jagah `removed_at` set karna. History aur references bache rehte hain. *ADR 0022*
- **Partial index**: sirf kuch rows par index/unique rule (`WHERE removed_at IS NULL`). *blocks_live_position_uidx*
- **Collation**: text ko sort/compare karne ke rules. `en_US` case ignore karta hai ('a1' < 'B1'); `"C"` = seedha byte order
  ('B1' < 'a1'). Fractional keys ko byte order chahiye. *ADR 0022*
- **Fractional indexing**: order ko sortable strings se rakhna. Do keys ke beech hamesha ek nayi key mil jaati hai, to insert
  karte waqt baaki rows nahi badalti. *ADR 0022*
- **TOAST / lz4**: Postgres bade values ko alag store karke compress karta hai (TOAST). `lz4` ek fast compression algorithm hai. *versions.snapshot*
- **Append-only**: sirf naye rows jud sakte hain, purane badle ya mitaye nahi ja sakte (audit log). *audit_events*
- **Drift**: do jagah rakhi ek hi cheez (DB CHECK aur TS list) ka dheere-dheere alag ho jaana. **Drift test** dono ko milata
  hai aur fark aate hi fail hota hai. *ADR 0021*
- **Codegen override**: generated type ko kisi column ke liye apne type se badalna (`role: string` → `MembershipRole`). *ADR 0021*
- **Undeclared (phantom) dependency**: package koi library use kare par apni dependency list me na likhe. Tab Node folders me
  upar dhoondhte hue jo bhi version mil jaaye wahi le leta hai (yahan galat TS 7). *ADR 0021*
- **pnpm `packageExtensions`**: kisi third-party package ki dependency list me bahar se entry jodna, uska code chhuye bina. *ADR 0021*
- **Silent failure**: error aaye par tool chupchaap fallback kar le aur success dikhaye ("✓ generated"). Sabse khatarnaak
  bug type, isliye output ka asli content check karo, sirf success message nahi. *ADR 0021*
- **Schema dump**: poore DB structure ki ek SQL file, jo migrations ke baad ka final result dikhati hai. *ADR 0020*
- **Connection pool**: pehle se khule DB connections ka set jo requests me reuse hota hai (naya connection banana mehenga hai). *client.ts*
- **ORM (Object-Relational Mapper)**: library jo tables ko classes/objects jaisa dikhati hai aur SQL khud likhti hai.
  Aasaan lagta hai, par SQL chhup jaata hai. *ADR 0008*
- **Query builder (Kysely)**: TS me SQL jaisa code likhte ho (`selectFrom('documents').where(...)`). Type-safe hai, par
  ORM jaisa magic nahi; jo likhoge wahi SQL banega. *ADR 0008*
- **Codegen**: code jo automatically generate hota hai (yahan live DB se TS types), haath se nahi likha jaata. *ADR 0008*
- **Valkey / Redis**: in-memory (RAM me) key-value store. Fast hai; queue, cache aur locks ke kaam aata hai. Valkey, Redis ka
  open-source fork hai. *ADR 0009*
- **Job queue (BullMQ)**: dhime kaam (email, PDF, AI) ko "baad me karo" list me daalna. Worker unhe ek-ek karke uthata hai,
  taaki user ki request atke nahi. *Design doc section 6*
- **License (BSD / AGPL)**: code use karne ki kanooni sharten. BSD bahut khula hai; AGPL kehta hai ki network par service
  chalao to apna modified code bhi share karo. *ADR 0009*

## Auth
- **Authentication (AuthN)**: "tum kaun ho?" (login). **Authorization (AuthZ)**: "tum kya kar sakte ho?" (roles/permissions).
- **Auth.js**: Next.js ke liye open-source login library (Google, email waghera). *ADR 0001*
- **Magic link**: password ki jagah email me ek one-time login link aata hai. *FR-35*

## Architecture
- **Modular monolith**: ek hi deployable app, par andar code saaf modules me banta hua. Microservices ki complexity ke
  bina, baad me todne ka rasta khula rehta hai. *ADR 0007*
- **Domain module**: ek business area ka code ek jagah (jaise `changes`, `decisions`). *ADR 0007*
- **Dependency direction**: kaun kisko import kar sakta hai. Yahan `apps → modules → platform`, ulta nahi. *ADR 0007*

## TypeScript / config patterns
- **Type stripping**: Node 26 `.ts` file se types hata kar bacha JS seedha chala deta hai, bina build ke. *ADR 0016*
- **Erasable syntax**: TS syntax jo sirf types hai aur hataya ja sakta hai. `enum` / `namespace` erasable nahi hain,
  kyunki ye runtime code banate hain. Isliye hum `as const` use karte hain. *ADR 0016, app-env.ts*
- **`as const`**: TS ko batata hai ki ye values kabhi nahi badlengi, to `["a","b"]` ka type `"a" | "b"` ban jaata hai. *app-env.ts*
- **`satisfies`**: check karo ki value kisi type se match karti hai, par value ka apna exact type mat khoo. *tunables/base.ts*
- **Type-check vs run**: `tsc --noEmit` sirf galtiyan dhoondta hai, code nahi banata. Node chalate waqt types ignore karta hai,
  isliye `./dev pnpm typecheck` alag se chalana zaroori hai. *ADR 0016*
- **Schema validation (Zod)**: data ka "shape + rules" ek jagah likho; runtime par check ho jaata hai aur TS type bhi wahin se
  ban jaata hai (`z.infer`). *platform/config*
- **Strict object schema**: unknown key = error. Override me typo (`heartbeatMS`) chupchaap ignore nahi hota. *tunables/schema.ts*
- **Cross-field validation (`refine`)**: rule jo do fields ko saath dekhta hai (heartbeat < idle release). *tunables/schema.ts*
- **Lazy vs eager**: eager = turant karo (import par); lazy = jab pehli baar zaroorat ho tab karo, phir cache karo. *ADR 0017*
- **Memoization / cache (`??=`)**: pehli baar compute karo, result yaad rakho, agli baar wahi lautao. *env.ts*
- **Deep merge**: nested objects ko andar tak milana (sirf top level nahi). *deep-merge.ts*
- **Prototype pollution**: `__proto__` jaisi key se saare objects ka base badal dena. Ye ek security bug hai, isliye aisi keys skip
  karte hain. *deep-merge.ts*
- **Freeze (`Object.freeze`)**: object read-only ho jaata hai, taaki runtime par galti se tunable na badle. *deep-merge.ts*
- **Pure function**: same input par hamesha same output, aur koi bahar ki cheez nahi chhoota. Test karna aasaan hai
  (`parseEnv(source)`). *env.ts*
- **Test fixture**: test ke liye fake data (`FAKE_SECRET`), asli secrets kabhi nahi. *env.test.ts*
- **Negative test / probe**: jaan-boojh kar galti daal kar dekhna ki check use pakadta hai ya nahi (jaise `enum` probe).
  Sirf "pass" dekhna kaafi nahi hota. *Step 1b*

## Tooling
- **Exact version pin (`savePrefix: ""`)**: `zod@4.6.7` likha jaata hai, `^4.6.7` nahi (`^` = "4.x me koi bhi naya chalega"). *ADR 0016*
- **git / remote / GitHub**: git code ki history rakhta hai; remote (GitHub) us history ki online copy hai. *ADR 0006*
- **Package manager**: tool jo libraries (dependencies) download aur version-manage karta hai. *ADR 0002*
- **Monorepo**: ek git repo me kai packages/apps (web app, worker, shared code). *ADR 0002*
- **Workspace (pnpm)**: monorepo ka har package; pnpm unhe aapas me link karta hai. *ADR 0002*
- **Zod**: TypeScript library jo runtime par data ka shape check karti hai aur usi se TS type bhi deti hai. *ADR 0003*
- **Environment variable (env var)**: OS/process ke bahar se di gayi value (secrets, URLs). Code me nahi likhi jaati. *CLAUDE.md section 4*
- **Docker container / image**: image ek ready "dabba" (OS + tools) ka template hai; container uska chalta hua instance hai.
  Har system par same dabba, to same behaviour milta hai. *ADR 0005*
- **Docker Compose**: ek YAML file jisme kai containers (dev, postgres, redis) ek saath define aur start hote hain. *ADR 0005*
- **Bind mount**: host ka folder container ke andar dikhana. Ek taraf file badlo, doosri taraf turant dikhti hai. *ADR 0005*
- **UID / GID**: Linux me user aur group ka number. Container isi se chale to banai gayi files aapki hoti hain, root ki nahi. *ADR 0005*
- **Healthcheck**: container ke andar baar-baar chalne waala chhota test (jaise `pg_isready`). Pass ho to service
  "healthy" hai; doosri services tab tak ruk sakti hain (`depends_on: condition: service_healthy`). *docker-compose.yml*
- **`docker compose exec` vs `run`**: `exec` pehle se chal rahe container me command chalata hai (fast); `run` naya container
  banata hai (`--rm` = khatam hote hi hata do). Hum `dev` ke liye exec aur `dbmate` ke liye run use karte hain. *ADR 0015*
- **Named volume**: Docker ka managed storage (jaise `postgres-data`). Container hat jaaye tab bhi data bacha rehta hai;
  `./dev reset` ise delete karta hai. *docker-compose.yml*
- **Compose profile**: service jo `up` par apne aap start nahi hoti, sirf maangne par chalti hai (hamara `dbmate`, profile `tools`). *docker-compose.yml*
- **YAML anchor (`&name`) / alias (`*name`) / merge (`<<:`)**: YAML me ek value ko naam dekar kai jagah reuse karna, taaki
  copy-paste na karna pade. *docker-compose.yml: healthcheck-timing, database-url*
- **`${VAR:?message}`**: Compose/shell syntax. VAR missing ho to error ke saath ruk jao (fail fast), khaali value se mat chalo. *docker-compose.yml*
- **Build arg (`ARG`)**: Docker image build karte waqt bahar se di gayi value (jaise version). *docker/dev.Dockerfile*
- **`set -euo pipefail`**: Bash script ki "strict mode". Error, undefined variable ya pipe me failure aate hi script ruk jaati hai. *./dev*
- **Lockfile (`pnpm-lock.yaml`)**: har dependency ka exact resolved version. Git me commit hota hai, taaki sabke paas bilkul
  same libraries install hon. *repo root*
- **Base image**: wo image jiske upar hum apni image banate hain (container ka OS). *ADR 0010*
- **glibc vs musl**: Linux programs ki basic C library. Debian glibc use karta hai, Alpine musl. Kai binaries (jaise Chromium)
  glibc maan kar bani hoti hain, isliye Alpine par tootti hain. *ADR 0010*
- **Headless browser (Chromium)**: bina screen ke chalne wala browser. Server par page render karke PDF banane ke kaam aata hai. *ADR 0010*
- **Version pinning**: exact version likhna (`26.13.0`, `latest` nahi), taaki build hamesha same rahe. *ADR 0005*
- **LTS (Long Term Support)**: version jise lambe samay tak security/bug fixes milte hain. *ADR 0005*
- **Hardcoded value / magic number**: code ke beech seedha likha number/string (`setTimeout(fn, 15000)`), jiska matlab aur
  source chhupa rehta hai. Hum inhe named config me rakhte hain. *CLAUDE.md section 4*
