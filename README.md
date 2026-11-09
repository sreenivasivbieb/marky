# Marky

PM Workspace: "Cursor for PRDs". PM rough idea se reviewed, shareable PRD tak pahunchta hai; AI changes **propose**
karta hai, log accept/reject karte hain, aur accepted decisions product memory ban jaate hain.

Ye ek **learning project** hai. Design: [`docs/design/pm-workspace-design.md`](docs/design/pm-workspace-design.md) ·
Faisle aur unke reasons: [`docs/adr/`](docs/adr/README.md) · Terms: [`docs/learning/glossary.md`](docs/learning/glossary.md)

## Quickstart

Host par sirf **Docker (Compose ke saath)** aur **git** chahiye. Node/pnpm host par install karne ki zaroorat nahi;
agar installed hain to bhi is project me use **nahi** hote (ADR 0005).

```bash
./dev init          # .env banao (random DB password)
./dev up            # Postgres + Valkey + dev container start
./dev pnpm install  # dependencies (container ke andar)
./dev help          # saari commands
```

## Config kahan rehta hai

| File | Git me? | Kya |
|---|---|---|
| `.env` | nahi | secrets + connection (DB password, ports) |
| `versions.env` | haan | tool/image versions |
| `docker-compose.yml` → `x-dev-tunables` | haan | infra tunables (healthcheck timing) |

Details: ADR 0015, aur `CLAUDE.md` section 4.
