# 0025. BYOK: team ki apni Anthropic API key (encrypted), token logging; spend cap hataya
- Status: Accepted (amended by 0027: provider-agnostic, usage = tokens only)
- Date: 2026-11-09
- Deciders: user (faisla); implementation details AI ne li (neeche alag)
- Type: **Design doc se deviation** (NFR-19, section 7 spend cap, section 10 cost control hataye; NFR-21 joda)

## Context
Pehle plan tha ki app ka apna Claude account sabke AI calls ka kharcha uthaye, isliye per-workspace daily spend cap aur
NFR-19 ("AI cost < 20% of plan price") the. User ne model badla: **har team apni Anthropic API key laati hai** (BYOK).

## Decision (user)
| Rakho | Hatao | Naya |
|---|---|---|
| **Token logging** (NFR-17): debugging aur user ko "aapne kitna use kiya" dikhane ke liye | Per-workspace daily cap; NFR-19; section 10 ka "cost control" paragraph | API key **encrypted** store; logs ya browser me **kabhi nahi**; **sirf Owner** dekh/badal sake |

Optional (baad me): team ka apna budget alert ("aaj $5 se zyada use hua"); runaway loop se unki hi key bachti hai.

## Implementation choices (AI ne liye)
- **Key ka scope = product** (tenant boundary, ADR 0019). Product ke Owners hi set / replace / delete karte hain.
- **"Dekh sake" = masked hint** (`…a1b2`, aakhri 4 characters). Poori key save hone ke baad kabhi wapas nahi dikhti, kyunki
  user ka rule hai ki key browser tak nahi jaani chahiye. Badalni ho to nayi key daalo.
- **Encryption:** app-level **AES-256-GCM** (Node `crypto`) + ek master key (`AI_KEY_ENCRYPTION_KEY`, env/secret,
  CLAUDE.md section 4). Har row me random IV + auth tag + `key_version` hota hai, taaki master key rotate ki ja sake.
  DB me sirf ciphertext jaata hai, aur DB dump leak hone par bhi key nahi khulti.
- **DB par do parat:** `marky_user` ko ciphertext column ka GRANT hi nahi hai (sirf hint aur metadata ka). Ciphertext ek
  SECURITY DEFINER function se milta hai jo sirf us product ke **Owner** ko jawab deta hai (AI chalana bhi owner-only hai).
- **Logging hygiene:** key kabhi log, error message ya audit metadata me nahi jaati. Audit me sirf
  "credential set/replaced/removed" + hint jaata hai.
- **Key nahi hai to:** AI features band, aur baaki app chalta hai (NFR-07 graceful degrade).
- **Runaway loop guard:** ek user turn me max tool iterations (tunable), kyunki ab cap nahi hai.
- **Usage ledger:** `ai_requests` table me har model call ke tokens (input / output / cache read / cache write), model aur
  anumaanit cost (pricing tunables se). Raw prompt text 30 din baad redact (ADR 0026).
- **Refusal fallback:** Claude API ka server-side `fallbacks: "default"` (claude-api skill ka default). Ye team ki hi key
  par chalta hai, aur fallback model ka kharcha bhi ledger me aata hai.

## Consequences
- App ka margin ab AI kharche par depend nahi karta. Risk badal gaya: team ka bill (runaway loop) → iteration limit, usage
  view, optional budget alert.
- Pricing (open question) ab AI cost se bandhi nahi hai.
- Master key kho gayi to saari saved keys bekaar ho jaayengi (teams ko dobara daalni padegi). Iska backup ops ki zimmedari hai.
