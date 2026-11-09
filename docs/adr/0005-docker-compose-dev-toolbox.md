# 0005. Dev environment: Docker Compose "toolbox" (Node + pnpm bhi container me)
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
User chahta hai ki project **kisi bhi system par same tareeke se chale**. Host par Node/pnpm ke alag versions
("mere machine par chalta hai") ka jhanjhat na ho. Host machine par pnpm installed bhi nahi tha (ADR 0002).
User ka editor VS Code / Cursor hai.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| A. Compose toolbox: `dev` container me Node + pnpm, code bind-mount, wrapper script | Host par sirf docker + git chahiye; kisi bhi editor ke saath chalta hai | Har command wrapper se chalani padti hai; UID/permission handle karna padta hai |
| B. Dev Container (`devcontainer.json`) | Editor andar chalta hai, types/extensions seamless | Editor-specific hai |
| C. Hybrid: `.mise.toml` pin + sirf services Docker me | Sabse fast | Doosre system par bhi mise chahiye, to "sirf Docker" waala goal toot jaata hai |

## Decision
**Option A: Compose toolbox.**
- `dev` service: Node + pnpm pinned versions ke saath. Code `/workspace` par bind-mount hoga, aur container **host user ki UID:GID** se chalega.
- `postgres` aur `redis` services bhi isi compose file me rahengi.
- Ek wrapper script (`./dev ...`) se commands container ke andar chalengi.
- Node version: **26 LTS**.

## Consequences
- `node_modules` bind-mount ki wajah se host par bhi dikhega, to VS Code ko types/autocomplete milte rahenge.
  (Ye host ke bajaye container ke Node se install hoga, isliye host par `pnpm`/`node` chalane ki zaroorat nahi.)
- Har image ka **exact version pin** hoga (`latest` kabhi nahi), taaki aaj aur 6 mahine baad same environment mile.
  Versions pin karte waqt (2026-11-09) latest stable the: node 26.13.0, pnpm 12.18.0, postgres 18.6, redis 8.10.3,
  valkey 9.1.3. Final choice compose file likhte waqt user confirm karega.
- Ports, DB password jaise values `.env` me rahengi (secrets/connection category, CLAUDE.md section 4), compose file me nahi.
- Abhi open hai: base image Alpine ho ya Debian-slim. Ye compose file likhne se pehle user se poocha jaayega.
  Isme dhyan dene ki baat ye hai ki baad me PDF export ke liye headless Chromium chahiye, aur Chromium Alpine (musl) par mushkil se chalta hai.
- Host par mise wala Node 26 bhi installed hai. Is project ke liye wo use nahi hoga, to confusion se bachne ke liye ye README me likhna hai.
