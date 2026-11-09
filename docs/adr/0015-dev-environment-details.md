# 0015. Dev environment ki details: ports, wrapper, versions, pnpm store, exec style
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)
- Builds on: ADR 0005 (Compose toolbox), 0010 (Debian slim), 0011 (dbmate)

## Decisions
| Topic | Faisla | Reason / trade-off |
|---|---|---|
| Host ports | **Default:** Postgres 5432, Valkey 6379, web 3000, sirf `127.0.0.1` par bind | Tutorials se match karte hain. Doosre project ke Postgres/Redis se clash ho to `.env` me port badal do |
| Wrapper | **Bash script `./dev`** | Host par sirf docker + git chahiye; Makefile ki tarah args ka jhanjhat nahi; `just` jaisa extra install nahi |
| pnpm store | **Repo ke andar `.pnpm-store/`** (gitignored) | `node_modules` ke saath same filesystem par hai, to pnpm hardlink kar sakta hai: fast install, kam disk |
| Version pins | **Alag `versions.env` file** (git me committed) | Versions secrets nahi hain, aur app tunables bhi nahi; "build config" hain. Ek jagah saare versions, `.env` se alag |
| Command style | **Long-running `dev` container + `docker compose exec`** | Har command ~0.2 s me chalti hai; Next.js dev server bhi wahin chalega |

## Config files ka naksha (CLAUDE.md section 4 ke saath)
| File | Git me? | Kya rehta hai |
|---|---|---|
| `.env` | **Nahi** | Secrets + connection: DB user/password/name, host ports |
| `.env.example` | Haan | `.env` ka template, sirf placeholder values |
| `versions.env` | Haan | Image/tool version pins |
| `docker-compose.yml` (`x-dev-tunables`) | Haan | Infra tunables, jaise healthcheck timing (named YAML anchor, ek jagah) |
| App tunables (TS + Zod, ADR 0003) | Haan | Baad me `platform/config` me |

## Consequences
- ADR 0002 me likha tha ki pnpm version `package.json` ke `packageManager` field me pin hoga. Ab version ka **akela source
  `versions.env` hai** (Docker image me wahi version install hota hai). `packageManager` field nahi rakhenge, taaki
  ek hi value do jagah na rahe.
- `./dev` dono env files load karta hai: `docker compose --env-file versions.env --env-file .env`.
- Container host user ki UID:GID se chalta hai (`./dev` `HOST_UID` / `HOST_GID` export karta hai).
- Container ke andar ke ports (Postgres 5432, Valkey 6379) image ke fixed defaults hain aur sirf Docker network ke andar
  dikhte hain. Host par kaunsa port khulega, ye `.env` se tay hota hai.
- **Provisional (user review pending):** dev me Valkey bina password ke chalta hai (sirf 127.0.0.1 par khula hai);
  dbmate ka `schema.sql` dump abhi off hai (ADR 0011 ka open sawal).
