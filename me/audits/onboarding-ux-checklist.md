# Onboarding UX Checklist

Run before launch and after major signup/onboarding flow changes. The first 5 minutes decide activation.

---

## Critical

- [ ] **Signup form is minimal** — email + password maximum for email signup; don't ask for name, company, phone upfront
- [ ] **OAuth/social signup available** — one-click with GitHub or Google removes the biggest friction point
- [ ] **No dead-end screens** — every screen has a clear next action; user is never stuck with no way forward
- [ ] **Signup success is unambiguous** — clear confirmation that the account was created and what happens next

---

## High

- [ ] **Email verification non-blocking** — user can explore the product before verifying; verification is encouraged, not a gate
- [ ] **First meaningful action reachable in < 2 minutes** — measure time from signup to first value moment
- [ ] **Empty states are instructional** — not just "No items" but "Connect your first service to start monitoring"
- [ ] **Setup steps are visible** — checklist or progress indicator showing what's configured vs. what's left
- [ ] **Skip options where appropriate** — don't force optional steps (team invite, notification setup) before the user sees value

---

## Medium

- [ ] **Welcome/onboarding screen on first login** — context about what the product does, what to do first
- [ ] **Feature discovery in context** — tooltips or inline prompts on first encounter with a feature, not a 10-step tour
- [ ] **Error messages during signup are helpful** — "An account with this email already exists — log in instead?" not "Error 409"
- [ ] **Redirect after login goes to the right place** — dashboard, not the homepage; preserve intended destination from before login
- [ ] **Password requirements shown upfront** — not revealed only after submission

---

## Low / Info

- [ ] Activation metric defined and tracked (e.g., "first integration connected")
- [ ] Drop-off points in the funnel instrumented with analytics
- [ ] Re-engagement email sent if user signs up but doesn't activate within 24–48 hours
- [ ] Team invitation flow tested end-to-end (invite email → accept → join team → see shared dashboard)
