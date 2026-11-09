# 0027. Provider-agnostic AI: native adapter per provider + apna ModelGateway; owner model chune; sirf tokens
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (faisle); kuch details AI ne li (neeche alag)
- Amends: ADR 0025 (cost estimate hataya; Claude-only assumptions hataye), ADR 0026 (summary bhi product ke model par)

## Context
User: "AI kuch bhi ho, zaroori nahi Opus 5.5; sab user ki di hui API key par depend karta hai."
Matlab app kisi ek AI provider se bandha nahi hai. Team jis provider ki key laaye, wahi chalega (BYOK, ADR 0025).

## Decision (user)
| Topic | Faisla |
|---|---|
| Providers | **Har provider ka native adapter**, provider ke official SDK se (OpenAI-compatible shortcut nahi) |
| Abstraction | **Apna thin `ModelGateway` interface**: system, messages, tools, max tokens, abort signal → text, tool calls, stop reason, usage |
| Model choice | **Owner provider + model chune** (Settings), key prefix se provider ka sujhaav, "Test connection" |
| Usage view | **Sirf tokens** (input / output / cache read / cache write jahan provider de). Cost kabhi nahi dikhega |

## Implementation choices (AI ne liye)
- **Pehle teen providers:** Anthropic, OpenAI, Google Gemini. Naya provider = ek naya adapter + `AI_PROVIDERS` list me
  entry (value list, drift-tested).
- **Neutral message format:** gateway ke apne types hain (role, text, tool call, tool result). Har adapter usse provider
  ke format me badalta hai. Engine aur orchestrator kisi provider SDK ko import nahi karte.
- **Provider-specific features adapter ke andar:** Anthropic par prompt caching (`cache_control`) aur refusal
  `fallbacks: "default"`. Jo provider ye na de, uska adapter bas use chhod deta hai. Orchestrator ko farak nahi padta.
- **Tool schema ek jagah:** `propose_change` / `suggest_decision` ke Zod schemas se JSON Schema banta hai; har adapter
  use apne tool format me lapet-ta hai. Model jo bhi lautaye, orchestrator **Zod se dobara validate** karta hai (kabhi
  bharosa nahi).
- **Capabilities:** model tool calling support na kare to "Test connection" fail hota hai, aur owner ko saaf message milta hai.
- **Tests:** `adapters/fake.ts` se. Har asli adapter ka ek optional live smoke test hai jo **sirf** user ki permission + key
  se chalta hai (paisa lagta hai).

## Consequences
- ADR 0025 ka "anumaanit cost (pricing tunables)" aur `DECISIONS.md` ka "Model = claude-opus-5-5" superseded hain.
- Prompt quality har model par alag hogi. Design doc ka AI eval set (30 tasks) har supported provider/model par chalana padega.
- Teen SDK dependencies (`@anthropic-ai/sdk`, `openai`, `@google/genai`); versions 3b me pin honge.
