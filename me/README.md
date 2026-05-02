# me

Personal knowledge base — reusable practices, checklists, templates, and tooling notes for web development projects. Compiled from Stackwatch (2025–2026).

> Not a library. Copy what you need into a new project.

---

## Structure

```
me/
├── practices/   Rules and conventions followed on every project
├── audits/      Copy-paste checklists for pre-launch and post-change reviews
├── stack/       Preferred tech choices and rationale
├── templates/   Starter files to drop into new projects
└── tools/       Notes on AI and graph tooling workflows
```

Full index with descriptions: [INDEX.md](INDEX.md)

---

## Practices

| File                                                                   | Topic                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [practices/coding-standards.md](practices/coding-standards.md)         | TypeScript, App Router, Tailwind, Radix UI, naming conventions                  |
| [practices/security-rules.md](practices/security-rules.md)             | Key handling, AES-256, RLS, CORS, HSTS, input validation                        |
| [practices/api-design-rules.md](practices/api-design-rules.md)         | HTTP semantics, URL naming, response envelope, pagination                       |
| [practices/error-handling-rules.md](practices/error-handling-rules.md) | Error boundaries, graceful degradation, user-facing messages                    |
| [practices/worker-patterns.md](practices/worker-patterns.md)           | Stateless workers, error isolation, polling loops, tier enforcement             |
| [practices/git-conventions.md](practices/git-conventions.md)           | .gitignore patterns, commit style, branch naming, multi-AI sync                 |
| [practices/frontend-design.md](practices/frontend-design.md)           | Anti-AI-slop design principles, skill workflow                                  |
| [practices/vercel-middleware.md](practices/vercel-middleware.md)       | Matcher config required — no matcher = invocation explosion + Fluid CPU charges |

## Audits

| File                                                                     | Covers                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [audits/pre-launch-checklist.md](audits/pre-launch-checklist.md)         | Infrastructure, security, monitoring, legal, QA — final gate     |
| [audits/api-security-checklist.md](audits/api-security-checklist.md)     | OWASP API Top 10 — auth, injection, rate limiting, data exposure |
| [audits/api-design-checklist.md](audits/api-design-checklist.md)         | HTTP semantics, naming, response shapes, pagination              |
| [audits/performance-checklist.md](audits/performance-checklist.md)       | Core Web Vitals (LCP, INP, CLS), images, fonts, JS bundles       |
| [audits/mobile-checklist.md](audits/mobile-checklist.md)                 | Touch targets, viewport, breakpoints, iOS Safari                 |
| [audits/error-handling-checklist.md](audits/error-handling-checklist.md) | Error boundaries, monitoring, user messages, empty states        |
| [audits/billing-checklist.md](audits/billing-checklist.md)               | PCI compliance, webhook verification, subscription enforcement   |
| [audits/onboarding-ux-checklist.md](audits/onboarding-ux-checklist.md)   | Signup flow, first-run experience, activation, team invites      |
| [audits/seo-checklist.md](audits/seo-checklist.md)                       | Structured data, crawlability, E-E-A-T, OG tags, AI search       |

## Stack

| File                                                       | Topic                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| [stack/saas-stack.md](stack/saas-stack.md)                 | Next.js + Supabase + Railway + Vercel + Resend + Dodo — rationale   |
| [stack/project-structure.md](stack/project-structure.md)   | Folder layout for Next.js SaaS + worker (`app/`, `worker/`, `lib/`) |
| [stack/frontend-libraries.md](stack/frontend-libraries.md) | Framer Motion, Remotion, shadcn/ui, react-hook-form, Recharts       |
| [stack/dodo-payments.md](stack/dodo-payments.md)           | Dodo Payments — checkout, webhooks, tier enforcement, UI patterns   |
| [stack/fumadocs.md](stack/fumadocs.md)                     | Fumadocs — docs framework setup, `.source/` fix, gotchas            |

## Templates

| File                                                                 | Produces                                        |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| [templates/claude-md-template.md](templates/claude-md-template.md)   | Blank `CLAUDE.md` scaffold                      |
| [templates/gitignore-nextjs.md](templates/gitignore-nextjs.md)       | Base `.gitignore` for Next.js + worker projects |
| [templates/worker-env-template.md](templates/worker-env-template.md) | All env vars a polling worker needs             |

## Tools

| File                                                     | Topic                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| [tools/graphify-workflow.md](tools/graphify-workflow.md) | When/how to run graphify, hook setup, reading outputs                      |
| [tools/code-review-graph.md](tools/code-review-graph.md) | Graphify MCP tools reference, query patterns, setup                        |
| [tools/ai-collaboration.md](tools/ai-collaboration.md)   | Multi-AI sync (Claude / Cursor / Windsurf / Gemini), workflow by task type |

---

## Starting a New Project

1. Copy [templates/claude-md-template.md](templates/claude-md-template.md) → `CLAUDE.md` and fill it in
2. Copy [templates/gitignore-nextjs.md](templates/gitignore-nextjs.md) → `.gitignore`
3. Add the graphify MCP block from [tools/code-review-graph.md](tools/code-review-graph.md) to `CLAUDE.md`
4. Run `/graphify` after the first commit to build the knowledge graph
5. Run the relevant [audits/](audits/) checklists before launch
