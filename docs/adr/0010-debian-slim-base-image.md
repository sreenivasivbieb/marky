# 0010. Docker base image: Debian trixie-slim
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
ADR 0005 me sab kuch containers me chalane ka faisla hua. Container ka OS (base image) chunna hai.
Baad me PDF export ke liye headless Chromium chahiye (design doc section 7: "Export"), aur Playwright E2E tests bhi.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| Debian trixie-slim | glibc hai, to Chromium/Playwright/native packages seedhe chalte hain; dev aur prod same | Image badi (~80MB base) |
| Alpine | Bahut chhota | musl libc par Chromium aur kai native modules tootte hain |
| Mixed | Har jagah chhota image | Do base images maintain karni padengi |

## Decision
**Debian trixie-slim** sab Node images ke liye (jaise `node:26.13.0-trixie-slim`).
Postgres aur Valkey apni official images use karenge (unka base hum nahi chunte).

## Consequences
- Ek hi base image hai, to "dev me chala, prod me nahi" ka risk kam rehta hai.
- Image size thoda zyada hoga. Production image ko chhota karne ke liye multi-stage build baad me (deploy step) dekhenge.
