# Coding Standards

## Language
- TypeScript everywhere — no plain JS, no `any` unless absolutely unavoidable
- Strict mode on (`"strict": true` in tsconfig)

## Framework (Next.js)
- Use App Router, not Pages Router
- Server Components by default — add `"use client"` only when you need browser APIs, event handlers, or state
- Co-locate page-specific logic in the route segment, not in `/lib`
- Wrap async auth checks in `<Suspense>` to avoid blocking static/edge rendering

## Code Style
- No unnecessary dependencies — if you can do it in 10 lines, don't add a package
- No speculative abstractions — three similar lines of code is better than a premature utility
- No backwards-compatibility hacks for code you're removing — delete it cleanly
- Comments only where logic isn't self-evident; don't narrate obvious code

## UI / Frontend
- Tailwind CSS for all styling — no inline styles, no CSS modules unless forced
- Radix UI for accessible interactive components (dialogs, dropdowns, tooltips)
- Recharts for data visualization
- Mobile-first: design for phone, then scale up
- Minimum touch target: 48×48px
- `next/image` for all images (auto-optimization, lazy load)
- `font-display: swap` for custom fonts; preload critical fonts

## Stack Defaults
- Database: Supabase (Postgres + RLS + Auth)
- Email: Resend (`alerts@yourdomain.dev`)
- Hosting: Vercel (frontend) + Railway (worker)
- Payments: Dodo Payments

## Response Shape Convention
All API routes return a consistent envelope:
```ts
// Success
{ data: T }

// Error
{ error: string }
```

## Naming
- Route files: kebab-case (`/api/alert-configs`)
- TypeScript types/interfaces: PascalCase
- Variables and functions: camelCase
- Database columns: snake_case
