# API Design Checklist

Run when building or reviewing API endpoints. Covers consistency, semantics, and developer experience.

---

## Critical

- [ ] **Correct HTTP methods** — GET reads, POST creates, PATCH updates, DELETE removes; no mutations on GET
- [ ] **Consistent response envelope** — every endpoint returns `{ data }` on success and `{ error }` on failure
- [ ] **Auth required on all private endpoints** — no route leaks data without a verified session
- [ ] **Correct status codes** — 200/201/204 for success; 400/401/403/404/422/429/500 for errors; never return `200` with an error body

---

## High

- [ ] **Consistent naming** — kebab-case paths (`/api/alert-configs`), camelCase JSON fields, plural nouns for collections
- [ ] **All list endpoints paginated** — never return unbounded arrays; default page size 20–50
- [ ] **Validation errors are field-level** — tell the caller exactly which field failed and why
- [ ] **Sensitive fields excluded from responses** — encrypted keys, internal tokens, password hashes never returned
- [ ] **Resource ownership verified** on every mutation — check the caller owns the resource, not just that they're authenticated

---

## Medium

- [ ] **Filtering supported on list endpoints** — query params for common filters (status, type, date range)
- [ ] **Bulk operations available** where clients commonly need to act on many resources at once
- [ ] **Partial update uses PATCH** — PUT is reserved for full replacement; document which fields are patchable
- [ ] **404 vs 403 used correctly** — don't reveal resource existence to unauthorized callers (return 404 for both)
- [ ] **Rate limit headers returned** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

---

## Low / Info

- [ ] API versioned from day one (`/v1/` prefix or `X-API-Version` header)
- [ ] Response times documented and measured — flag endpoints over 500ms
- [ ] Idempotency keys supported on payment/critical POST endpoints
- [ ] OpenAPI/Swagger spec generated or maintained alongside the code
