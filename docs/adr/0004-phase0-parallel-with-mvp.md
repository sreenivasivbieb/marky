# 0004. Phase 0 (validation) aur Phase 1 (MVP) parallel chalenge
- Status: Superseded by 0014
- Date: 2026-11-09
- Deciders: user
- Type: **Design doc se deviation**

## Context
Design doc (section 2) kehta hai: "no phase starts until the previous gate passes". Gate 0 (validation) fail ho to
project wahin rukna chahiye, code likhne se pehle. Isse galat cheez banane me mehnat barbaad nahi hoti.

## Decision
User ne decide kiya ki Phase 0 (problem brief, interviews, validation report) aur MVP build **saath-saath** chalenge.

## Consequences
- Fayda: seekhna turant shuru hota hai, aur interviews me dikhane ke liye ek working prototype bhi milega.
- Risk: agar validation me pata chale ki wedge galat hai, to bana hua kuch code badalna ya phenkna pad sakta hai.
- Mitigation: sabse pehle wo hissa banayenge jo har case me kaam aayega (foundation + change engine). Wedge-specific
  features (templates, linter rules) validation ke findings aane ke baad hi pakke kiye jaayenge.
- Phase 0 ke documents kahan aur kaise banenge, aur unme AI ka role kya hoga, ye abhi decide hona baaki hai.
