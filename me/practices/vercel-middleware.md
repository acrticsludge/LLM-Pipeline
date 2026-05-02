# Vercel Middleware — Invocation Cost Gotcha

## The Problem

Next.js middleware runs on **every incoming request by default** — including `_next/static`, `_next/image`, favicon, and all other static assets. On Vercel, each middleware invocation counts toward your usage. Without a matcher, a single page load can trigger 10–20+ middleware calls (one per asset), and Fluid compute charges you for active CPU on each one.

Symptoms:
- Middleware invocation count in the thousands/hour for a small-traffic app
- Unexpectedly high Fluid active CPU usage in Vercel analytics
- Billing spikes with no obvious traffic explanation

---

## The Fix — Always Set a Matcher

Every `middleware.ts` must have an explicit `config.matcher` that excludes static files.

```ts
// middleware.ts
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
```

For auth-only middleware (most common case), this is tighter and clearer:

```ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/team/:path*',
    '/alerts/:path*',
    '/integrations/:path*',
  ],
};
```

Explicit route list is the safest option — you know exactly what the middleware runs on.

---

## Rules

1. **Never ship middleware without a matcher.** The "runs on everything" default is a billing trap.
2. **Prefer an explicit route list** over a negative regex — it's auditable and won't silently expand.
3. **Check invocation counts after deploying middleware changes.** Vercel shows this in the Functions tab.
4. **Middleware should be lightweight.** Auth token checks and redirects only — no DB queries, no external API calls.

---

## Checklist (add to pre-launch)

- [ ] `middleware.ts` has an explicit `config.matcher`
- [ ] Matcher excludes `_next/static`, `_next/image`, and static asset extensions
- [ ] Middleware does no DB or external API calls (token check only)
- [ ] Invocation count checked in Vercel dashboard after first deploy
