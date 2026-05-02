# Security Rules

These are non-negotiable. Apply to every project.

## Secrets & API Keys
- **Never log raw API keys, tokens, or passwords** — not even in dev
- Encrypt all user-supplied credentials before storing in the database (AES-256)
- The encryption key itself lives in an environment variable, never in code
- No secrets in client bundles — anything in `NEXT_PUBLIC_` is visible to everyone
- `.env*` files are always gitignored; never commit them

## Database (Supabase / Postgres)
- **Row Level Security (RLS) must be enabled on every table** — the database enforces isolation, not application code
- Each user can only read/write their own rows; enforce via `auth.uid() = user_id` policies
- Use the service role key only in the worker/server context, never exposed to the client
- Use `anon` key on the client — it respects RLS

## Authentication
- Validate the session server-side on every protected route/API handler
- Never trust user-supplied `user_id` in request bodies — always read from the verified session
- Token expiry and rotation handled by the auth provider (Supabase Auth)
- OAuth providers: only enable what you actually use

## Input Validation
- Validate all user input at system boundaries (API routes, server actions)
- Use Zod or equivalent schema validation — don't hand-roll checks
- Reject unknown fields (strip or error, don't pass through)
- File uploads: validate MIME type server-side, enforce size limits, prevent path traversal

## HTTP / Headers
- HTTPS everywhere — no HTTP in production
- HSTS header required: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- CORS: only whitelist known origins, never `*` in production
- Content-Security-Policy: set it; tighten `connect-src` when adding new third-party domains

## API Security
- All non-public endpoints require a valid session
- Check resource ownership on every mutation — don't just check "is logged in", check "owns this"
- Rate-limit public/auth endpoints (sign-in, sign-up, password reset)
- Never expose stack traces or internal error messages to the client

## Payments
- Never store raw card data — delegate entirely to the payment provider
- Verify webhook signatures before processing any payment event
- Enforce subscription tier server-side (worker + API); the UI is just a hint
