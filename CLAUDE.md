## Development Standards

Follow these rules on every change — new files, edits, refactors, and fixes.

### TypeScript & Next.js

- TypeScript everywhere. No `any`. Strict mode on.
- App Router only. Server Components by default — `"use client"` only for browser APIs, events, or state.
- Co-locate route logic in the segment. Shared logic in `lib/`.

### API Design

- All routes return `{ data: T }` on success, `{ error: string }` on failure. No exceptions.
- Correct HTTP methods. Correct status codes (never `200` with an error body).
- Validate request body with Zod on every POST/PATCH. Reject unknown fields. Field-level errors on failure.
- Paginate all list endpoints. Never return unbounded arrays.
- Never return sensitive fields (tokens, encrypted keys, passwords) in responses.

### Security

- Never log API keys, tokens, or passwords.
- Validate session server-side on every protected route. Never trust user-supplied `user_id`.
- Check resource ownership on every mutation — not just authenticated, but authorized.
- Verify webhook signatures before processing any payment event.
- RLS enabled on all DB tables. Service role key server-only.
- Input validated at every system boundary (API routes, server actions).

### Error Handling

- `error.tsx` on every major route segment with a recovery action.
- Third-party calls wrapped in try/catch. Log server-side, return generic message to client.
- Never expose stack traces to the client.
- Loading states on all async operations.
- User-facing errors are actionable and specific.

### Middleware

- Always set `config.matcher`. Never run middleware on `_next/static`, `_next/image`, or static assets.
- Middleware does token checks and redirects only — no DB or external API calls.

### Code Style

- No unnecessary dependencies.
- No speculative abstractions.
- Comments only where the WHY is non-obvious.
- Delete removed code cleanly — no backwards-compat hacks.

### Styling

- Tailwind only. No inline styles. Mobile-first. Touch targets ≥ 48×48px.
- `next/image` for all images.

### Forms

- `react-hook-form` + `zod` + `@hookform/resolvers` for all forms.

### README.md

- Always update README.md after every edit you make.
