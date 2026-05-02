# SEO Checklist

Covers technical SEO, structured data, E-E-A-T signals, and AI search readiness. Run before launch.

---

## Critical

- [ ] **`<title>` and `<meta name="description">` on every page** — unique per page, not duplicated
- [ ] **Canonical URL set** — `<link rel="canonical">` on all pages to prevent duplicate content
- [ ] **robots.txt present** — allows crawlers on public pages, blocks private/dashboard routes
- [ ] **XML sitemap present and submitted** — includes all public pages, excludes auth/dashboard routes
- [ ] **No `noindex` on pages that should rank** — check that meta robots tags aren't accidentally blocking indexing
- [ ] **Structured data (JSON-LD) present** — at minimum: Organization, WebSite; add Product/SoftwareApplication for SaaS

---

## High

- [ ] **Structured data validates without errors** — test with Google's Rich Results Test; no missing required fields
- [ ] **Schema prices match actual prices** — mismatch between schema and UI risks a Google manual action
- [ ] **AggregateRating only added if reviews are real and verifiable** — fake or unverifiable ratings are a manual action risk
- [ ] **Open Graph tags on all public pages** — `og:title`, `og:description`, `og:image`, `og:url`
- [ ] **OG image is the right size** — 1200×630px; test with social preview tools
- [ ] **Core Web Vitals passing** — LCP < 2.5s, INP < 200ms, CLS < 0.1 (see performance checklist)
- [ ] **Mobile-friendly** — Google indexes mobile-first; pass mobile usability check

---

## Medium

- [ ] **BreadcrumbList schema on deep pages** — helps Google understand site hierarchy
- [ ] **FAQ schema on pricing/feature pages** — eligible for FAQ rich result in SERPs
- [ ] **Heading hierarchy correct** — one `<h1>` per page, logical `<h2>`/`<h3>` nesting
- [ ] **Alt text on all images** — descriptive, not keyword-stuffed
- [ ] **Internal linking** — key pages linked from multiple places; no orphan pages
- [ ] **Page speed** — see performance checklist; slow pages rank lower

---

## AI Search / GEO (Generative Engine Optimization)

- [ ] **Clear factual claims** — AI systems cite pages with clear, quotable facts ("X does Y in Z minutes")
- [ ] **Author/founder identity established** — About page with real person, LinkedIn link, credentials
- [ ] **Third-party mentions** — press coverage, directory listings, review sites (Product Hunt, G2, etc.)
- [ ] **llms.txt considered** — `llms.txt` at domain root helps AI crawlers understand site structure
- [ ] **E-E-A-T signals present** — Experience, Expertise, Authoritativeness, Trustworthiness on key pages

---

## Low / Info

- [ ] Hreflang tags if serving multiple languages/regions
- [ ] `<meta name="robots" content="max-image-preview:large">` for image search
- [ ] Google Search Console connected and sitemap submitted
- [ ] 404 page returns actual `404` status code (not a `200` soft 404)
