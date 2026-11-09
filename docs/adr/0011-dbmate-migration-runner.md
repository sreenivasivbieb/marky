# 0011. Migration runner: dbmate
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
ADR 0008: schema ka source of truth plain `.sql` migration files hain. Ek tool chahiye jo ye files database par
chalaye aur yaad rakhe ki kaunsi chal chuki hain.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| dbmate | Single binary aur official Docker image; plain SQL me `-- migrate:up` / `-- migrate:down`; language-independent | Watch mode nahi |
| graphile-migrate | `current.sql` save karte hi apply (fast RLS loop) | Down migration nahi; concept naya hai |
| Kysely Migrator | Ek tool kam | Migrations TS me, jo ADR 0008 ke "plain .sql" se hatta hai |

## Decision
**dbmate**, Docker Compose ke andar chalega (host par install nahi, ADR 0005).
Migrations `platform/db/migrations/` me rahengi, file naam `YYYYMMDDHHMMSS_description.sql`.

## Consequences
- dbmate DB me `schema_migrations` table rakhta hai jisme likha hota hai ki kaunsi migrations chal chuki hain.
- Har migration me `down` section likhna hoga, taaki rollback test ho sake.
- dbmate `schema.sql` dump bhi likh sakta hai. Use git me rakhna hai ya nahi, ye pehli migration ke time user se poochhenge.
- Connection URL env var se aayega (secrets category, CLAUDE.md section 4).
