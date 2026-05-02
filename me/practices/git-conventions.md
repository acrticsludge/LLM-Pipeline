# Git Conventions

## .gitignore — Always Exclude
```
# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# build artifacts
/.next/
/out/
/build
*.tsbuildinfo
next-env.d.ts

# environment files — NEVER commit
.env*

# platform metadata
.DS_Store
*.pem
.vercel

# debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# generated / tooling output
/graphify-out
/coverage

# personal knowledge base
/me
```

## What to Never Commit
- `.env`, `.env.local`, `.env.production` — any environment file
- Private keys (`*.pem`, `*.key`)
- `/node_modules` — always regenerable
- Build artifacts (`/.next`, `/build`, `/out`)
- Generated tool output (`/graphify-out`, `/coverage`)

## Commit Message Style
- Present-tense imperative: "add Slack alert channel", not "added" or "adding"
- Lead with the area: "worker: fix rate limit handling for GitHub", "ui: fix mobile nav overflow"
- Keep subject line under 72 characters
- Body (optional) explains *why*, not *what* — the diff shows what

## Branch Naming
- Feature: `feat/short-description`
- Fix: `fix/short-description`
- Chore/infra: `chore/short-description`
- Main branch: `main`

## Multi-AI Sync
When using multiple AI tools (Claude, Cursor, Windsurf, Gemini), keep these files in sync — they all serve the same purpose on different platforms:
- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Claude agent mode
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `GEMINI.md` — Gemini

Update all of them together when project conventions change.

## Hooks
- Pre-commit: run type check / lint
- Post-commit: rebuild knowledge graph (via `python -m graphify hook install`)
- Never skip hooks with `--no-verify` unless absolutely necessary and documented why
