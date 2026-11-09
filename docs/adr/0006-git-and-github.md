# 0006. Version control: git (local) + GitHub remote
- Status: Accepted
- Date: 2026-11-09
- Deciders: user

## Context
Code ki history chahiye, aur ADR/design notes PR me review karne ka tareeka bhi (design doc section 2:
"write a short design note ... review it in a pull request").

## Decision
- Local git repo, default branch `main` (2026-11-09 ko initialise hua).
- GitHub par remote repo banega, `gh` CLI se, account `sreenivasivbieb`.
- `.gitignore` me `.env*` (sirf `.env.example` allowed hai), `node_modules`, build output.

## Consequences
- **Commit aur push sirf user ke bolne par** (CLAUDE.md section 3.7). Remote repo banana bhi outward-facing kaam hai,
  isliye repo ka naam aur visibility user confirm karega.
- Secrets galti se commit na hon, iske liye baad me ek pre-commit secret scan jodne par vichar kiya ja sakta hai
  (abhi decide nahi hua).

## Addendum (2026-11-09): pending detail bhari gayi, faisla nahi badla
- User ne chuna: repo naam **`marky`**, visibility **public**.
- Repo bana: https://github.com/sreenivasivbieb/marky (khaali), aur local `origin` remote set hua.
- Public hone ka asar: jo bhi push hoga (ADR, docs, CLAUDE.md, aur usme diya gaya design doc link) sab duniya dekh sakegi.
  Isliye secrets ka `.gitignore` rule aur bhi zaroori hai.
