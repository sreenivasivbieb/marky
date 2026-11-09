# 0009. Queue / cache / locks: Valkey (Redis-compatible), Redis ki jagah
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)
- Type: **Design doc se chhota deviation** (doc me "Redis with BullMQ" likha hai)

## Context
Design doc Redis use karta hai: job queue (BullMQ), rate limits, edit locks. 2024 me Redis ne apna license
BSD se badal kar source-available kar diya (baad me AGPL option bhi aaya). Iske jawab me Linux Foundation ne
**Valkey** fork banaya, jo BSD license me hai aur Redis protocol ke saath compatible hai.

## Decision
**Valkey 9.1** (pin karte waqt exact patch version: 9.1.3).

## Consequences
- Code aur libraries (BullMQ, ioredis client) me koi badlaav nahi, kyunki protocol same hai. Docs/tutorials me "Redis" padho to
  Valkey par bhi lagu hota hai.
- Production me managed Valkey (jaise AWS ElastiCache for Valkey) available hai.
- Risk: agar BullMQ ka koi feature Valkey par alag behave kare, to Step "worker" me test karke pata chalega.
  Zarurat padi to naya ADR likhkar Redis par wapas ja sakte hain.
