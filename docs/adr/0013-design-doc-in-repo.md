# 0013. Design doc ki copy repo me; Google Doc ka link repo me nahi
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
Repo public hai (ADR 0006). `CLAUDE.md` me original Google design doc ka link tha. Push hote hi link duniya ko dikhta,
aur sharing settings ke hisaab se poora doc khul sakta tha.

## Decision
- Link repo se hataya gaya.
- Doc ka content `docs/design/pm-workspace-design.md` me markdown copy ke roop me rakha gaya. Ab ye repo ka source of truth hai.
- Original Google Doc private rahega, sirf user ke paas.

## Consequences
- Repo self-contained hai: koi bhi model/agent bina internet ke design padh sakta hai.
- Original doc ke 3 diagrams (lifecycle + gate numbers, state diagram, architecture) copy nahi hue; unka text content copy me hai.
  Gate numbers Phase 0 me user ke saath tay honge (ADR 0012).
- Ab do jagah content hai. Design badle to **repo copy update hogi** (ADR ke saath); Google Doc ko update karna user ki marzi hai.
- Note: ye copy bhi public hogi. Design doc me secrets nahi hain, par product plans hain, aur user ne inhe public rakhna accept kiya hai.
