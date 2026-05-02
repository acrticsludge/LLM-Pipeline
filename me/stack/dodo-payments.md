# Dodo Payments

Integration guide and patterns for using Dodo Payments in a SaaS product.

---

## What Dodo Payments Is

Dodo Payments is a payment infrastructure provider focused on international markets — particularly useful when Stripe isn't the right fit (India-first billing, regional payment methods, etc.). It handles subscriptions, one-time payments, and checkout flows.

---

## Setup

```bash
npm install dodo-payments  # or the SDK package name for your version
```

Environment variables required:
```env
DODO_PAYMENTS_API_KEY=your-api-key
DODO_PAYMENTS_WEBHOOK_SECRET=your-webhook-secret
```

Never expose the API key client-side. Use it only in API routes and the worker.

---

## Core Integration Pattern

### 1. Create a Checkout Session (Server-Side)
```ts
// app/api/billing/checkout/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { tier } = await req.json();
  const session = await createSession();  // get user from Supabase auth

  const checkout = await dodo.checkout.create({
    plan_id: PLAN_IDS[tier],
    customer_email: session.user.email,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { user_id: session.user.id, tier },
  });

  return NextResponse.json({ url: checkout.url });
}
```

### 2. Redirect to Checkout (Client-Side)
```ts
const res = await fetch("/api/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ tier: "pro" }),
});
const { url } = await res.json();
window.location.href = url;  // redirect to Dodo-hosted checkout
```

### 3. Handle Webhooks (Server-Side) — CRITICAL
**Always verify the webhook signature.** An unverified webhook endpoint means anyone can fake a payment event and upgrade themselves for free.

```ts
// app/api/webhooks/dodo/route.ts
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("webhook-signature") ?? "";

  // Verify signature before doing anything
  const isValid = dodo.webhooks.verify(body, signature, process.env.DODO_PAYMENTS_WEBHOOK_SECRET!);
  if (!isValid) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(body);

  switch (event.type) {
    case "subscription.activated":
    case "subscription.renewed":
      await updateUserTier(event.data.metadata.user_id, event.data.metadata.tier);
      break;
    case "subscription.cancelled":
    case "subscription.expired":
      await updateUserTier(event.data.metadata.user_id, "free");
      break;
    case "payment.failed":
      await handlePaymentFailure(event.data.metadata.user_id);
      break;
  }

  return new Response("ok", { status: 200 });
}
```

---

## Subscription Lifecycle Events to Handle

| Event | Action |
|-------|--------|
| `subscription.activated` | Set user tier in DB, send welcome email |
| `subscription.renewed` | Update `subscription.updated_at` in DB |
| `subscription.cancelled` | Downgrade tier at period end (not immediately) |
| `subscription.expired` | Enforce tier downgrade — disable excess features |
| `payment.failed` | Send dunning email, start grace period |
| `payment.recovered` | Cancel any pending downgrade, restore access |

---

## Tier Enforcement Rules

1. **Source of truth is your DB** (`subscriptions` table), not Dodo's state — sync via webhooks
2. **Downgrade at period end**, not immediately on cancellation — user paid for the rest of the period
3. **Grace period on payment failure** — give 3–7 days before downgrading
4. **Enforce in both API and worker** — the UI shows upgrade prompts; the backend enforces limits

```ts
// lib/tiers.ts
export async function getUserTier(userId: string): Promise<"free" | "pro" | "team"> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .single();

  if (!data || data.status !== "active") return "free";
  return data.tier;
}
```

---

## Payments UI Patterns

### Use the `/claude-api` or `/frontend-design` skills for building the payments UI

**Upgrade prompt (inline):**
- Show when user hits a free tier limit — not a popup, an inline nudge
- "You've used 1/1 integrations on the free plan. Upgrade to Pro for up to 5."
- CTA: "Upgrade — $10/mo →"

**Pricing page:**
- Three tier cards; highlight the Pro tier (recommended)
- Monthly/annual toggle with the annual saving shown: "Save $24/year"
- Feature comparison list — check marks for included, dash or gray for not included
- CTA buttons go to `/api/billing/checkout` with the tier in the request body

**Success state:**
- After checkout redirect, check `?upgraded=true` in the URL
- Show a success toast or banner: "Welcome to Pro! Your new limits are active."
- Don't rely solely on the webhook — optimistically show the upgrade confirmation, then verify on next page load

---

## Security Checklist

- [ ] Webhook endpoint verifies the signature before processing any event
- [ ] API key is server-side only — never in `NEXT_PUBLIC_*`
- [ ] Subscription tier read from DB, not from client request body
- [ ] User cannot set their own tier by calling the API directly
- [ ] Payment failure triggers a grace period email, not an immediate hard lock
- [ ] Webhook events are idempotent — processing the same event twice produces the same result
