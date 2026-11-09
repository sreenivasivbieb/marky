# 0016. TypeScript bina build step (Node native) + Vitest
- Status: Accepted
- Date: 2026-11-09
- Deciders: user (AI ne options aur recommendation di)

## Context
Monorepo ke internal packages (`@marky/config`, aage `@marky/changes` waghera) ko web app, worker aur tests import karenge.
Node 26 `.ts` files seedhe chala sakta hai (**type stripping**: types hata kar bacha JS chala deta hai).
TypeScript 7 (Go me likha native compiler, ~10x fast) available hai.

## Options
| Option | Fayda | Nuksaan |
|---|---|---|
| **No-build** (package `exports` seedha `.ts` par) | Koi build/watch nahi; change turant dikhta hai | Sirf "erasable" TS syntax: `enum`, `namespace`, constructor parameter properties nahi |
| Compiled packages (`tsc` → `dist/`) | Sabse compatible | Har change par build/watch |
| Bundler (tsup/tsdown) | Publish-ready output | Internal packages ke liye zyada setup |

Test runner: **Vitest** (watch, coverage for NFR-18, acchi output) vs `node:test` (zero dependency, coverage experimental).

## Decision
- **No-build.** Package `exports` → `./src/index.ts`. Worker `node src/main.ts` se chalega; Next.js `transpilePackages` se compile karega.
- TypeScript 7 sirf **type-check** karega (`tsc --noEmit`), JS kabhi emit nahi karega.
- tsconfig me `erasableSyntaxOnly: true`, taaki galti se `enum` likha jaaye to type-check fail ho. Enum ki jagah `as const`
  arrays/objects use honge.
- Relative imports me `.ts` extension likhna zaroori hai (`./env.ts`), kyunki Node khud extension guess nahi karta.
- **Vitest** test runner.

## Consequences
- Dependencies **exact version** pin hongi (`savePrefix: ''`, ADR 0005 ki pinning soch ke saath). `^` ranges nahi.
- Type errors runtime par nahi pakde jaate (Node types ignore karta hai), isliye `./dev pnpm typecheck` chalana zaroori hai.
  CI me ye mandatory hoga.
- Koi library agar compiled JS hi maange, to us package ke liye exception ka naya ADR likhna padega.
