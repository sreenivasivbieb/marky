# 0012. Phase 0 workflow: AI drafts, user interviews leta hai
- Status: Superseded by 0014
- Date: 2026-11-09
- Deciders: user
- Related: ADR 0004 (Phase 0 parallel with MVP)

## Context
Phase 0 ke documents chahiye: problem brief, interview notes, validation report (go / no-go). Original design doc me
gate numbers ek diagram me the, jo repo copy me nahi aaye.

## Decision
- Sab Phase 0 documents `docs/phase-0/` me rahenge.
- **AI draft karega:** problem brief, interview script, gate / kill-criteria ka *proposal*.
- **User karega:** interviews lena, notes paste karna, aur kill-criteria ke numbers final karna.
- AI notes ka synthesis karke validation report draft karega. **Go / no-go ka faisla sirf user ka hoga.**

## Consequences
- Kill criteria interviews shuru hone se *pehle* user approve karega (design doc ka rule: numbers pehle, kaam baad me).
- Interview notes me asli logon ke naam/company ho sakte hain, aur repo **public** hai (ADR 0006). Notes kahan rakhe jaayein
  (git me anonymised, ya git ke bahar), ye pehle interview se pehle user se poochhna hai.
