# 0014. Phase 0 (validation) track poora skip; sirf MVP build
- Status: Accepted
- Date: 2026-11-09
- Deciders: user
- Supersedes: 0004, 0012
- Type: **Design doc se deviation**

## Context
ADR 0004 me Phase 0 ko MVP ke saath parallel chalana tay hua tha. ADR 0012 me Phase 0 ka workflow tay hua tha
(AI drafts, user interviews). Ab user ne decide kiya ki Phase 0 ka koi bhi kaam nahi hoga: na interviews,
na problem brief, na kill criteria, na validation report.

## Decision
**Phase 0 track skip.** Seedha Phase 1 (MVP build) par focus.

## Consequences
- Design doc ka "Gate 0" safety net nahi rahega. Validation ke bina MVP banta hai to "galat cheez acche se ban jaane" ka risk
  rehta hai (design doc section 12: "PMs like the idea but will not pay for the review loop").
- Ye learning project hai, to us risk ki keemat kam hai. Yahan maqsad technology aur methodology seekhna hai, market jeetna nahi.
- `docs/phase-0/` nahi banega.
- Baad me validation chahiye ho to naya ADR likh kar Phase 0 wapas laaya ja sakta hai.
