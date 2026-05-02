# Mobile Responsiveness Checklist

Run before launch and after major UI changes. Test on real devices or browser DevTools device emulation.

---

## Critical

- [ ] **Viewport meta tag present** — `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] **No horizontal scroll** — nothing overflows the viewport width on 375px (iPhone SE baseline)
- [ ] **Touch targets minimum 48×48px** — all buttons, links, checkboxes, and interactive elements
- [ ] **Base font size ≥ 16px** — prevents iOS auto-zoom on input focus
- [ ] **Forms usable on mobile** — correct `inputmode`/`type` attributes trigger the right keyboard (`email`, `tel`, `numeric`)

---

## High

- [ ] **All breakpoints covered** — 375px (phone), 768px (tablet), 1024px (desktop) at minimum
- [ ] **Navigation usable on mobile** — hamburger menu, bottom nav, or drawer pattern; desktop nav doesn't overflow
- [ ] **Modals and dialogs constrained to viewport** — no fixed-size dialogs wider than the screen
- [ ] **Images responsive** — `width: 100%` or `max-width: 100%`; no fixed pixel widths that overflow on small screens
- [ ] **No hover-only states** — interactive elements that rely on hover are also accessible via tap/focus

---

## Medium

- [ ] **Flex/Grid layouts wrap correctly** — no items getting cut off or overflowing at small sizes
- [ ] **Tables have mobile fallback** — responsive table (horizontal scroll wrapper) or card-based alternative
- [ ] **Sticky/fixed headers don't eat content** — account for header height in scroll anchors and modals
- [ ] **Orientation change handled** — layout doesn't break when rotating between portrait and landscape
- [ ] **Bottom sheet/drawer pattern used** for mobile menus/panels** — not a desktop dropdown forced onto mobile

---

## Low / Info

- [ ] Tested on real iOS Safari and Android Chrome (not just Chrome DevTools)
- [ ] 300ms tap delay eliminated — `touch-action: manipulation` or framework handles it
- [ ] Pinch-to-zoom not disabled — don't set `user-scalable=no` (accessibility violation)
- [ ] Dark mode supported or explicitly not supported (but don't break in dark mode by accident)
