# Billing & Payments Checklist

Run before enabling payments in production. Payment bugs = lost revenue or fraud.

---

## Critical

- [ ] **No card data stored in your database** — all card handling delegated to the payment provider (Stripe, Dodo, etc.)
- [ ] **Webhook signatures verified** — validate the `webhook-signature` or `stripe-signature` header before processing any event
- [ ] **Subscription tier enforced server-side** — the worker and API check tier limits; the UI is just a hint
- [ ] **No payment bypass via API** — a user cannot manually set their own tier by calling the API directly
- [ ] **PCI-compliant payment UI** — use provider-hosted elements (Stripe Elements, etc.); don't build custom card inputs

---

## High

- [ ] **Idempotency on payment operations** — use idempotency keys to prevent duplicate charges on retry
- [ ] **Failed payment / dunning handled** — what happens when a subscription payment fails? (grace period, downgrade, email)
- [ ] **Subscription state is source of truth in your DB** — sync from webhook events, not from client-side callbacks
- [ ] **Tier downgrade enforced** — when a user cancels or downgrades, excess integrations/features are disabled
- [ ] **Trial period tracked and enforced** — trial end triggers the same flow as a failed payment

---

## Medium

- [ ] **Price consistency** — the price shown in the UI matches what the payment provider charges; no mismatch between monthly/annual
- [ ] **Tax handling** — is tax collected? Is it correct per jurisdiction? Is it shown before checkout?
- [ ] **Refund/cancellation flow** — user can cancel self-serve; refund policy is documented
- [ ] **Upgrade prompt shown** when user hits free tier limits — not a silent failure
- [ ] **Billing history accessible** — user can see past invoices/receipts in the settings page

---

## Low / Info

- [ ] Webhook events logged with payload for debugging
- [ ] Payment events have an audit trail (who paid, when, how much, which plan)
- [ ] Test mode payments work end-to-end in staging before enabling production
- [ ] Stripe/provider dashboard access restricted to authorized team members only
