# 0026. AI memory: chat turns document ke saath, rolling summary, chat se decision ka sujhaav
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (faisla); implementation details AI ne li (neeche alag)
- Type: **Design doc se deviation** (section 8 ka redaction rule badla)

## Context (user ka diagnosis)
Chat me jo baatein hui par Change ya "Mark as decision" nahi bani (jaise PM ne kaha "ye feature Q2 me nahi karenge"),
wo 30 din baad redact ho jaati aur AI ko yaad nahi rehti.

## Decision (user)
1. **Chat history DB me save, AI ko sirf haal ke turns** (chat history wale sawal ka option 1).
2. **Auto-suggest decision:** chat me "decide kiya" / "cut karte hain" jaisa kuch aaye to AI poochhe "Isse decision ke roop
   me save karein?" (ek click).
3. **Rolling summary:** har document ka ek chhota auto-updated summary ("is doc me ab tak ye discuss hua"), jo aakhri
   turns ke saath AI ko jaata hai.
4. **Redaction rule:** 30 din ka redaction sirf **raw AI request logs** par (jisme poora prompt text hota hai).
   `chat_turns` document ka hissa hai, isliye document ke saath rehta hai.
5. **Decisions table = memory ka sabse bada source.**

## Implementation choices (AI ne liye)
- **Chat se decision:** `decisions.change_id` ab nullable hai, aur naya `chat_turn_id` joda gaya hai. Ek CHECK
  rule ke hisaab se decision **ya to** Change se bana hota hai **ya** chat se. `version_number` ab bhi required hai (jis
  version ke waqt faisla hua), taaki FR-15 ka "link to the version" bana rahe.
- **Sujhaav ka flow:** AI ek tool `suggest_decision(summary, reason)` call karta hai, jo khud kuch save **nahi** karta. Sujhaav
  assistant ke chat turn par save hota hai, aur owner ka "Save as decision" click hi decision row banata hai
  ("AI proposes, people decide").
- **Rolling summary:** `documents.chat_summary` (+ `chat_summary_turn_id`, yaani kaunse turn tak summarise hua). Har
  assistant turn ke baad ek chhoti model call purana summary + naye turns ko nayi summary me badalti hai (same model,
  `effort: low`). Summary fail ho to chat nahi rukti; agli baar dobara koshish hoti hai.
- **AI ko context ka order:** active decisions (sabse upar, cache-friendly) → rolling summary → aakhri N turns (tunable)
  → document → naya message.
- **Purane turns replay nahi hote:** har user message ek naya API conversation hai, aur pichhli chat text ke roop me jaati hai.
  Isse Opus 5.5 ka "preserved thinking" check kabhi nahi tootta (purane thinking blocks bheje hi nahi jaate).

## Consequences
- Chat data document ki life tak rehta hai (product delete = document delete, ADR 0019 / design doc section 8).
- Har assistant turn par ek extra (chhoti) model call team ki key par lagti hai.
