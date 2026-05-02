# API Security Checklist

Covers OWASP API Top 10. Run before launch and after major auth/API changes.

---

## Critical

- [ ] **All non-public endpoints require authentication** — no route returns user data without a verified session
- [ ] **Object-level authorization on every mutation** — verify the caller owns the resource, not just that they're logged in
- [ ] **No raw secrets or API keys logged** — search codebase for `console.log` near token/key variables
- [ ] **Input validated with a schema** (Zod/Joi/yup) on every POST/PATCH handler — reject on failure with `400`
- [ ] **SQL/NoSQL injection prevention** — use parameterized queries or ORM; never string-concatenate user input into queries
- [ ] **Webhook signatures verified** before processing any payment or third-party event
- [ ] **No sensitive fields in API responses** — encrypted keys, internal tokens, passwords never returned

---

## High

- [ ] **Rate limiting on auth endpoints** (login, signup, password reset, magic link) — prevent brute force
- [ ] **Rate limiting on public/expensive endpoints** — prevent abuse and DoS
- [ ] **CORS restricted to known origins** — no wildcard `*` in production
- [ ] **HSTS header set** — `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] **Content-Security-Policy header set** — tighten `connect-src`, `script-src` to known domains
- [ ] **No stack traces returned to client** — catch all unhandled errors and return generic `500` message
- [ ] **File uploads validated server-side** — MIME type check, size limit, no path traversal

---

## Medium

- [ ] **Token expiry configured** — short-lived access tokens, refresh token rotation
- [ ] **RBAC enforced at the API layer** — role/permission checked on the server, not just in the UI
- [ ] **Request body size limits** — prevent large payload attacks (set in middleware or framework config)
- [ ] **Unknown fields stripped** from request body — don't pass arbitrary user-supplied keys to the DB
- [ ] **Error messages don't reveal internal details** — no DB error strings, no file paths in responses
- [ ] **API versioning in place** — breaking changes go in a new version, not silently to existing consumers

---

## Low / Info

- [ ] Dependency audit run (`npm audit`) — no known critical vulnerabilities in deps
- [ ] Security headers tested (securityheaders.com or equivalent)
- [ ] OAuth scopes are minimal — request only what you actually need
- [ ] Sensitive query params not logged — filter `token`, `key`, `password` from access logs
