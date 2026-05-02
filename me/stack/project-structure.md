# Project Structure

Standard layout for a Next.js SaaS with a polling worker.

---

## Root Layout

```
/
  app/                    # Next.js App Router
  worker/                 # Background polling worker (separate Node.js process)
  lib/                    # Shared utilities (used by both app/ and worker/)
  public/                 # Static assets
  Audits/                 # Audit reports and checklists (not committed if sensitive)
  me/                     # Personal knowledge base (gitignored)
  graphify-out/           # Knowledge graph output (gitignored)
  CLAUDE.md               # AI assistant instructions and project spec
  AGENTS.md               # Same as CLAUDE.md but for Claude agent mode
  .cursorrules            # Same content for Cursor
  .windsurfrules          # Same content for Windsurf
  GEMINI.md               # Same content for Gemini
  .mcp.json               # MCP server configuration (graphify)
  .gitignore
  package.json
  tsconfig.json
```

## `/app` Structure (Next.js App Router)

```
app/
  layout.tsx              # Root layout (fonts, providers, nav)
  page.tsx                # Landing page (public)
  dashboard/
    page.tsx              # Main usage overview (protected)
    loading.tsx           # Skeleton while data loads
    error.tsx             # Error boundary
  integrations/
    page.tsx              # Manage connected services
  alerts/
    page.tsx              # Alert history
  settings/
    page.tsx              # Thresholds, channels, account, billing
  team/
    page.tsx              # Team dashboard (Team tier only)
    invite/
      page.tsx            # Accept team invite
  pricing/
    page.tsx              # Pricing page (public)
  login/
    page.tsx
  signup/
    page.tsx
  auth/
    callback/
      route.ts            # OAuth callback handler
  api/
    integrations/
      route.ts            # GET list, POST create
      [id]/
        route.ts          # GET, PATCH, DELETE
    usage/
      route.ts
    alerts/
      route.ts
    team/
      route.ts
    webhooks/
      route.ts            # Push notification subscription
    billing/
      route.ts
```

## `/worker` Structure

```
worker/
  index.ts                # Entry point — starts polling loop
  pollCycle.ts            # Main orchestration
  thresholds.ts           # Threshold evaluation logic
  spikes.ts               # Spike detection
  lib/
    encryption.ts         # Shared with app/ (or symlinked)
  services/
    github.ts
    vercel.ts
    supabase.ts
    railway.ts
  alerts/
    email.ts
    slack.ts
    discord.ts
    push.ts
  .env                    # Worker-specific env vars (gitignored)
  package.json
  tsconfig.json
```

## `/lib` Structure (shared)

```
lib/
  supabase.ts             # Supabase client initialization
  encryption.ts           # AES-256 encrypt/decrypt for API keys
  tiers.ts                # Tier limit checks and enforcement
```

---

## Key Conventions

1. **`lib/` is shared** between app routes and the worker — put truly shared logic here, not app-specific helpers
2. **Each service gets its own file** in `worker/services/` — never mix GitHub and Vercel logic
3. **Each alert channel gets its own file** in `worker/alerts/` — email.ts handles only email
4. **API routes follow REST conventions** — see `practices/api-design-rules.md`
5. **Audit files live in `/Audits/`** — run them before launch; keep reports for reference
6. **AI config files stay in sync** — update CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, GEMINI.md together
