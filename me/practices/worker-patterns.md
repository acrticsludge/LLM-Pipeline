# Worker / Background Job Patterns

## Core Principle: Stateless
The worker holds no in-memory state between runs. All state — what was last polled, what alerts fired, what thresholds are set — lives in the database. The worker can be restarted, redeployed, or run multiple instances without data loss or duplication.

## Polling Loop Structure
```ts
async function pollCycle() {
  const integrations = await db.getAllActiveIntegrations();

  for (const integration of integrations) {
    try {
      await processIntegration(integration);
    } catch (err) {
      console.error(`[worker] Integration ${integration.id} failed:`, err);
      await db.updateIntegrationStatus(integration.id, 'error');
      // continue to next — never re-throw
    }
  }
}
```

## Rules
1. **Never throw from the top-level loop** — catch per-integration, log, and move on
2. **Update status in the DB** on every failure (`status = 'error'`, `last_error = message`)
3. **Idempotent by design** — running the same poll cycle twice produces the same DB state (upsert, don't duplicate)
4. **No in-memory caches** — read fresh from DB each cycle; cache invalidation bugs are worse than the extra query
5. **Enforce tier limits in the worker** — don't rely solely on the frontend to block pro features

## Polling Intervals (Tier-Based)
Fetch the user's tier from the DB; skip if not due yet. Store `last_polled_at` per integration.
- Free: every 15 minutes
- Pro: every 5 minutes
- Team: every 1 minute

## Alert Firing — No Spam
Track alert state in a dedicated table (`alert_history`). Before firing:
1. Check if an alert was already sent for this metric in its current "crossed" state
2. Only re-alert when the metric drops below threshold and crosses again
3. Record every fired alert with: integration_id, metric_name, percent_used, channel, sent_at

## Environment Variables (Required)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY  # server-only, never exposed to client
ENCRYPTION_KEY             # must match the frontend encryption key
RESEND_API_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

## Deployment (Railway)
- Run as a standalone Node.js process (`ts-node` or compiled `node dist/index.js`)
- Use Railway's restart policy — let it crash and restart rather than adding recovery logic
- No cron inside the worker — use `setInterval` or Railway's cron trigger
- Log to stdout only — Railway captures and stores logs automatically

## Error Classification
| Error Type | Action |
|-----------|--------|
| 401/403 from third-party API | Mark integration `error`, notify user, stop polling |
| 429 rate limited | Log, skip this cycle, retry next interval |
| 500 from third-party | Log, mark error, retry next cycle |
| DB connection failure | Log, abort entire cycle, restart worker |
| Unexpected exception | Log with full stack, mark integration error, continue |
