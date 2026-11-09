# 0007. Monorepo layout: apps / modules / platform
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
Design doc (section 6) kehta hai: "modular monolith: one deployable app plus workers; split later along the existing
module lines". Matlab aaj ek hi app deploy hogi, par code aise bante ki kal kisi module ko alag service banana aasaan ho.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| Domain modules (apps / modules / platform) | Doc ke module lines se match; har module ki apni zimmedari | Zyada packages |
| Enforced boundaries (upar wala + dependency-cruiser) | Boundaries tool se enforce hoti hain | Setup zyada |
| Simple layered (ek `core` package) | Shuru me aasaan | Baad me todna padega |

## Decision
**Domain modules:**
```
marky/
├─ apps/        deployable cheezein: web (Next.js UI + API), worker (BullMQ jobs)
├─ modules/     business logic, ek module = ek domain (changes, decisions, documents, sharing, …)
├─ platform/    infra jo sab use karte hain: db, config, ai
├─ docker/      Dockerfiles; root par docker-compose.yml aur ./dev wrapper
└─ docs/        adr/, learning/
```

## Consequences
- Dependency ki direction: `apps → modules → platform`. Ulta (jaise `platform` ka `modules` ko import karna) galat hai.
  Abhi ye convention hai, tool se enforce nahi hota. "Enforced boundaries" baad me jod sakte hain (naye ADR ke saath).
- Modules tabhi banenge jab unki zaroorat aaye. Khaali folders pehle se nahi banayenge.
- `platform/config` me tunables aur env loader **do alag files/modules** honge (ADR 0003, CLAUDE.md section 4).
