# Performance Checklist

Focus: Core Web Vitals + loading speed. Run before launch and after major UI changes.
Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1, TTFB < 800ms.

---

## Critical

- [ ] **LCP element identified and optimized** — largest image/text block loads fast; use `priority` prop on hero images
- [ ] **TTFB under 800ms** — check server response time; use edge caching or CDN for static routes
- [ ] **No render-blocking resources** — CSS and fonts don't block initial paint
- [ ] **`next/image` (or equivalent) used for all images** — automatic format conversion, lazy load, responsive srcset
- [ ] **Video has `poster` attribute** — prevents blank frame causing LCP spike; preload `metadata` not `auto`

---

## High

- [ ] **CLS under 0.1** — no layout shifts from images without dimensions, late-loading fonts, or dynamic content insertion above fold
- [ ] **Custom fonts use `font-display: swap`** — text visible immediately with fallback font
- [ ] **Critical fonts preloaded** — `<link rel="preload" as="font">` for above-the-fold typefaces
- [ ] **JavaScript bundle analyzed** — no unexpectedly large chunks; use `next build --analyze`
- [ ] **Code splitting in place** — dynamic imports for heavy components not needed on initial load
- [ ] **Third-party scripts deferred** — analytics, chat widgets, tag managers use `async`/`defer` or load after interaction

---

## Medium

- [ ] **Images have explicit width and height** (or `aspect-ratio` CSS) — prevents CLS
- [ ] **Lazy loading on below-fold images** — `loading="lazy"` or Intersection Observer
- [ ] **Next.js Server Components used for data fetching** — avoid client-side fetch waterfalls on initial load
- [ ] **Static pages use ISR or full static generation** — not SSR unless data changes per-request
- [ ] **No unnecessary re-renders** — memo/useCallback for expensive components if profiler shows it

---

## Low / Info

- [ ] Core Web Vitals monitored in production (Vercel Analytics, Sentry, or similar)
- [ ] Performance budget set — alert when bundle size grows beyond threshold
- [ ] Lighthouse score baseline recorded before launch
- [ ] HTTP/2 or HTTP/3 confirmed on hosting provider
