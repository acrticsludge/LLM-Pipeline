# Pre-Launch Checklist

The final gate before going live. Run top to bottom.

---

## Infrastructure

- [ ] **DNS configured correctly** — A/CNAME records pointing to production hosting
- [ ] **SSL certificate valid and auto-renewing** — test with SSL Labs; ensure no mixed content warnings
- [ ] **www ↔ non-www redirect** — pick one canonical and redirect the other with `301`
- [ ] **All environment variables set in production** — no `undefined` values; no dev/test keys slipping in
- [ ] **Debug mode disabled** — `NODE_ENV=production`; no verbose logging, no dev overlays
- [ ] **`graphify-out/`, `/me`, and other dev artifacts excluded from deployment**

---

## Security

- [ ] All items in `api-security-checklist.md` — Critical and High
- [ ] HTTPS enforced on all routes
- [ ] HSTS header set
- [ ] CSP header configured
- [ ] `.env` files not deployed (use platform environment variable injection)

---

## Monitoring & Operations

- [ ] **Error monitoring active** — Sentry or equivalent capturing production exceptions
- [ ] **Analytics initialized** — Vercel Analytics, Plausible, or equivalent
- [ ] **Uptime monitoring set up** — alert if site goes down (Better Uptime, UptimeRobot, etc.)
- [ ] **Status page exists** — users can check if issues are known
- [ ] **Backup procedure documented** — how is the DB backed up? How often? How to restore?

---

## Legal & Compliance

- [ ] **Privacy policy present and linked** — in footer, on signup page
- [ ] **Terms of service present and linked** — in footer, on signup page
- [ ] **Cookie policy** — if using non-essential cookies or analytics
- [ ] **Data retention policy defined** — what data is stored, for how long, and how users can delete it
- [ ] **GDPR/CCPA applicable?** — if targeting EU or California users, compliance required

---

## Quality Assurance

- [ ] **Smoke test the happy path** — sign up → connect service → see usage data → trigger alert
- [ ] **Smoke test auth flows** — email/password, OAuth, magic link, password reset
- [ ] **Smoke test payments** — upgrade, downgrade, cancel, webhook events
- [ ] **Cross-browser test** — Chrome, Firefox, Safari (especially mobile Safari)
- [ ] **All environment-specific URLs/keys correct** — no staging URLs, test API keys in production

---

## Polish

- [ ] **Favicon and app icon present** — 32×32 favicon, 180×180 apple-touch-icon
- [ ] **OG image set** — social share preview looks correct
- [ ] **Custom 404 page** — branded, with navigation back to the app
- [ ] **All forms submit correctly** — no broken form actions pointing to dev URLs
- [ ] **Loading states consistent** — no spinners missing on slow operations
- [ ] **Email sending tested** — transactional emails arrive, from address is correct, links work
