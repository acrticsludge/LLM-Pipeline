# Error Handling Checklist

Run before launch. One bad error boundary or missing catch block can make the whole app feel broken.

---

## Critical

- [ ] **`error.tsx` present on every major route segment** (App Router) — unhandled server errors show a recovery UI, not a blank page
- [ ] **No stack traces exposed to users** — catch all server errors and return generic messages
- [ ] **Unhandled promise rejections caught** — no uncaught async errors crashing the Node.js process
- [ ] **Third-party API failures don't cascade** — each integration wrapped in try/catch; one failing doesn't break the rest

---

## High

- [ ] **All API routes return correct error status codes** — `400` for bad input, `401` for unauth, `500` for server errors; never `200` with error body
- [ ] **User-facing error messages are actionable** — "GitHub token expired — reconnect your account" not "Something went wrong"
- [ ] **Form validation errors shown inline** — field-level, not just a toast at the top
- [ ] **Loading states on all async operations** — spinner/skeleton while fetching; never blank content without indication
- [ ] **Timeout handling on slow requests** — show a message and retry option if a fetch takes too long

---

## Medium

- [ ] **Error monitoring integrated** (Sentry, LogFlare, etc.) — errors captured in production with context
- [ ] **Error context preserved in logs** — user ID, route, integration ID, timestamp logged alongside the error
- [ ] **Retry logic with backoff** for transient failures (don't retry blindly in a tight loop)
- [ ] **Empty states designed** — every list/table has an empty state that isn't just a blank space
- [ ] **404 page customized** — not the hosting provider's default

---

## Low / Info

- [ ] Critical error alerting configured — oncall notification if error rate spikes
- [ ] Error boundary recovery offers a useful action (retry, go home, contact support)
- [ ] Offline/network error handled — show a banner or message when the device is offline
- [ ] `console.error` replaced with structured logging in production builds
