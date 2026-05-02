# My SaaS Stack

Battle-tested choices for building SaaS products. Updated from Stackwatch (2025–2026).

---

## Frontend
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js (App Router)** | Server components, edge rendering, built-in routing, Vercel-native |
| Language | **TypeScript** | Strict mode; catch bugs at compile time, not runtime |
| Styling | **Tailwind CSS** | Utility-first, no CSS file bloat, works great with component libraries |
| Components | **Radix UI** | Headless, accessible primitives; style with Tailwind on top |
| Charts | **Recharts** | React-native, composable, good enough for dashboards |

## Backend / Database
| Layer | Choice | Why |
|-------|--------|-----|
| Database | **Supabase (Postgres)** | RLS built-in, auth included, real-time, good free tier, great DX |
| Auth | **Supabase Auth** | Email/password, magic link, GitHub OAuth, Google OAuth out of the box |
| ORM | **Supabase JS client** | Direct SQL when needed, RLS enforced automatically |

## Infrastructure
| Layer | Choice | Why |
|-------|--------|-----|
| Frontend hosting | **Vercel** | Next.js native, edge network, instant deployments, preview URLs |
| Worker hosting | **Railway** | Simple Node.js deployment, cron triggers, env var management, cheap |
| Email | **Resend** | Developer-friendly, good deliverability, React email templates |
| Payments | **Dodo Payments** | Works for international markets; alternatives: Stripe (US/EU), LemonSqueezy |

## Security
| Layer | Choice | Why |
|-------|--------|-----|
| Secret encryption | **AES-256 (Node.js crypto)** | Encrypt user API keys before DB storage; key in env var |
| Multi-tenancy | **Supabase RLS** | DB enforces row isolation — no application-level tenant bugs |

## Tooling
| Tool | Purpose |
|------|---------|
| **graphify** | Build a knowledge graph of the codebase for architecture understanding and AI querying |
| **Biome / ESLint** | Linting and formatting |

---

## Tier Structure Pattern (SaaS Pricing)

```
Free    — 1 account per service, email-only alerts, 15-min polling, 7-day history
Pro     — Multiple accounts, all channels, 5-min polling, 30-day history + graphs  ($10/mo)
Team    — Everything in Pro + team features, 1-min polling, 90-day history         ($30/mo)
```

**Enforcement rule:** Tier limits checked in both the API and the worker. The UI shows upgrade prompts — it never silently fails.

---

## What I'd Change for the Next Project
- Consider **Drizzle ORM** instead of raw Supabase queries for better type safety on complex joins
- Consider **Trigger.dev** or **Inngest** instead of a raw Railway worker for more robust job scheduling and retry logic
- **Stripe** if the primary market is US/EU (better ecosystem than Dodo for that region)
