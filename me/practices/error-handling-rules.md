# Error Handling Rules

## The Core Rule
**One failure must not cascade.** A third-party API going down, a database query timing out, or one user's integration erroring should never take down the entire request, page, or polling cycle.

## Server-Side (API Routes / Worker)
- Wrap every third-party call in `try/catch`
- Log the full error server-side (stack trace, context, integration ID)
- Return a generic message to the client — never expose stack traces or internal details
- In polling workers: catch per-integration, log, and continue to the next one
- Use specific error types where possible; don't throw raw strings

```ts
try {
  const data = await fetchThirdPartyApi(integration);
} catch (err) {
  console.error(`[service] Integration ${integration.id} failed:`, err);
  // update integration status to 'error' in DB, then continue
}
```

## Client-Side (React)
- Add `error.tsx` to every major route segment in the App Router
- Error boundaries must show a recovery action (retry button, back link) — not just a message
- Never show raw error objects or stack traces to users
- Loading states: always show a skeleton or spinner while async data loads
- Timeout states: if a fetch takes >10s, show a timeout message with retry

## User-Facing Error Messages
- Be specific enough to be actionable: "GitHub token is invalid or expired — reconnect your account" beats "Something went wrong"
- For validation errors: tell the user exactly which field failed and why
- For auth errors: redirect to login with a `?reason=` param so you can show context
- For permission errors: explain what the user needs (upgrade prompt, team invite, etc.)

## HTTP Error Codes
Return correct status codes — don't return `200` with `{ error: "..." }` in the body.
See `api-design-rules.md` for the full mapping.

## Monitoring
- Integrate error monitoring (Sentry, LogFlare, etc.) before launch
- Alert on: unhandled exceptions, 5xx rate spikes, worker crashes
- Preserve error context: user ID, integration ID, route, timestamp

## What NOT to Do
- Don't swallow errors silently (`catch (err) {}`)
- Don't use `console.log` for errors in production — use structured logging
- Don't return `500` for user errors — `400`/`422` for bad input, `403` for auth
- Don't retry blindly in a loop — use exponential backoff with a max retry count
