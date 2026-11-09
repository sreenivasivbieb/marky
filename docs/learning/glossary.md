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
