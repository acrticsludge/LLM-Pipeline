# My Knowledge Base

Personal reusable practices, checklists, and templates. Compiled from Stackwatch (2025–2026).
Gitignored — not committed. Copy relevant files into new projects as needed.

---

## Practices

Rules and conventions I follow on every project.

| File | What's in it |
|------|-------------|
| [practices/coding-standards.md](practices/coding-standards.md) | TypeScript, App Router, Tailwind, Radix UI, naming conventions |
| [practices/security-rules.md](practices/security-rules.md) | Never log keys, AES-256 encryption, RLS, CORS, HSTS, input validation |
| [practices/api-design-rules.md](practices/api-design-rules.md) | HTTP semantics, URL naming, response envelope, pagination, status codes |
| [practices/error-handling-rules.md](practices/error-handling-rules.md) | Error boundaries, graceful degradation, user-facing messages, monitoring |
| [practices/worker-patterns.md](practices/worker-patterns.md) | Stateless workers, per-service error isolation, polling loops, tier enforcement |
| [practices/git-conventions.md](practices/git-conventions.md) | .gitignore patterns, commit style, branch naming, multi-AI file sync |
| [practices/frontend-design.md](practices/frontend-design.md) | Anti-AI-slop design principles, ui-ux-pro-max + frontend-design skill workflow |
| [practices/vercel-middleware.md](practices/vercel-middleware.md) | Matcher config required — no matcher = invocation explosion + Fluid CPU charges |

---

## Audits

Copy-paste checklists for pre-launch and post-change reviews. All generalized — no project-specific details.

| File | What it covers |
|------|---------------|
| [audits/api-security-checklist.md](audits/api-security-checklist.md) | OWASP API Top 10 — auth, injection, rate limiting, sensitive data |
| [audits/api-design-checklist.md](audits/api-design-checklist.md) | HTTP semantics, naming consistency, response shapes, pagination |
| [audits/performance-checklist.md](audits/performance-checklist.md) | Core Web Vitals (LCP, INP, CLS), images, fonts, JS bundles |
| [audits/mobile-checklist.md](audits/mobile-checklist.md) | Touch targets, viewport, breakpoints, iOS Safari, orientation |
| [audits/error-handling-checklist.md](audits/error-handling-checklist.md) | Error boundaries, monitoring, user messages, empty states |
| [audits/billing-checklist.md](audits/billing-checklist.md) | PCI compliance, webhook verification, subscription enforcement, dunning |
| [audits/onboarding-ux-checklist.md](audits/onboarding-ux-checklist.md) | Signup flow, first-run experience, activation, team invites |
| [audits/seo-checklist.md](audits/seo-checklist.md) | Structured data, crawlability, E-E-A-T, OG tags, AI search (GEO) |
| [audits/pre-launch-checklist.md](audits/pre-launch-checklist.md) | Infrastructure, security, monitoring, legal, QA, polish — the final gate |

---

## Stack

My preferred technology choices and why.

| File | What's in it |
|------|-------------|
| [stack/saas-stack.md](stack/saas-stack.md) | Next.js + Supabase + Railway + Vercel + Resend + Dodo — stack rationale |
| [stack/project-structure.md](stack/project-structure.md) | Folder layout for Next.js SaaS + worker (app/, worker/, lib/) |
| [stack/frontend-libraries.md](stack/frontend-libraries.md) | Framer Motion, Remotion, shadcn/ui, react-hook-form, Recharts, and more |
| [stack/dodo-payments.md](stack/dodo-payments.md) | Dodo Payments integration — checkout, webhooks, tier enforcement, UI patterns |
| [stack/fumadocs.md](stack/fumadocs.md) | Fumadocs docs framework — setup, `.source/` chicken-and-egg fix, provider import paths, gotchas |

---

## Templates

Starter files to copy into new projects.

| File | What it produces |
|------|-----------------|
| [templates/claude-md-template.md](templates/claude-md-template.md) | Blank CLAUDE.md scaffold — fill in per project |
| [templates/gitignore-nextjs.md](templates/gitignore-nextjs.md) | Base .gitignore for Next.js + worker projects |
| [templates/worker-env-template.md](templates/worker-env-template.md) | All environment variables a polling worker needs |

---

## Tools

How I use the AI and graph tooling.

| File | What's in it |
|------|-------------|
| [tools/graphify-workflow.md](tools/graphify-workflow.md) | When/how to run graphify, hook setup, reading outputs, Windows fix |
| [tools/code-review-graph.md](tools/code-review-graph.md) | Graphify MCP tools reference, query patterns, setup, when to fall back to file tools |
| [tools/ai-collaboration.md](tools/ai-collaboration.md) | Multi-AI sync (Claude/Cursor/Windsurf/Gemini), workflow by task type |

---

## How to Use This in a New Project

1. Copy [templates/claude-md-template.md](templates/claude-md-template.md) → `CLAUDE.md` and fill it in
2. Copy [templates/gitignore-nextjs.md](templates/gitignore-nextjs.md) → `.gitignore`
3. Copy [tools/code-review-graph.md](tools/code-review-graph.md) → add the graphify MCP block to CLAUDE.md
4. Run `/graphify` after the first commit to build the knowledge graph
5. Run the relevant [audits/](audits/) checklists before launch
