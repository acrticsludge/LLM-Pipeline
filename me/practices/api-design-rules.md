# API Design Rules

## HTTP Semantics
| Method | Use for |
|--------|---------|
| GET | Read — no side effects, cacheable |
| POST | Create a new resource |
| PUT | Replace a resource entirely |
| PATCH | Partial update |
| DELETE | Remove a resource |

Never use GET for mutations. Never use POST when PATCH is correct.

## URL Naming
- kebab-case paths: `/api/alert-configs`, `/api/team-members`
- Plural nouns for collections: `/api/integrations`, not `/api/integration`
- Resource IDs in the path: `/api/integrations/:id`
- Actions that don't map cleanly to CRUD: use a verb suffix sparingly: `/api/invites/:token/accept`

## Response Shape
Always return a consistent envelope:
```ts
// 200 Success
{ "data": <resource or array> }

// 4xx / 5xx Error
{ "error": "Human-readable message" }
```

Never mix — don't return a bare array or bare object on success and an envelope on error.

## Status Codes
- `200` — success (GET, PATCH, PUT)
- `201` — created (POST)
- `204` — success, no body (DELETE)
- `400` — bad request / validation failure
- `401` — not authenticated
- `403` — authenticated but not authorized
- `404` — resource not found
- `409` — conflict (duplicate, state mismatch)
- `422` — unprocessable entity (valid JSON, invalid business logic)
- `429` — rate limited
- `500` — server error (log it, return generic message)

## List Endpoints
- All list endpoints must support pagination (offset+limit minimum; cursor preferred for large sets)
- Default page size: 20–50 items
- Always return total count alongside the page: `{ data: [...], total: N, page: N, limit: N }`
- Support filtering via query params: `?status=active&service=github`

## Security on Responses
- Never return sensitive fields (encrypted keys, internal IDs used as secrets, passwords)
- Strip fields the caller isn't authorized to see at the serialization layer, not in the DB query
- Don't over-fetch: return only what the caller needs

## Validation
- Validate request body against a Zod schema at the top of every POST/PATCH handler
- Return `400` with field-level errors on validation failure:
  ```json
  { "error": "Validation failed", "fields": { "threshold": "Must be between 1 and 100" } }
  ```
- Reject unknown fields — don't silently pass them through

## Error Handling
- One failing integration/resource must not cause the whole request to fail
- Wrap third-party API calls in try/catch; return partial results with an `errors` array when appropriate
- Never let an unhandled promise rejection crash the route

## Versioning
- Pin API version in a header (`X-API-Version`) or path prefix (`/v1/`) from day one
- Breaking changes require a new version — never change an existing endpoint's response shape silently
