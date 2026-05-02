# Frontend Design — Avoiding AI Slop

A guide for producing genuinely good UI rather than the generic gradient-hero, card-grid, blue-button output that AI tools default to.

---

## What AI Slop Looks Like

You'll recognize it instantly:
- Purple-to-blue gradient hero section with a centered heading and one CTA button
- Three identical feature cards in a row with an icon, title, and two lines of text
- "Trusted by 1,000+ developers" logo strip immediately after the hero
- Generic sans-serif font (Inter or DM Sans used without thought)
- Every section padded identically, no rhythm variation
- White background, gray text, blue primary button — everywhere

The problem isn't that these patterns are wrong. It's that they're reflexive — chosen because they're easy, not because they're right for the product.

---

## How to Use the ui-ux-pro-max Skill

Before writing any UI code, invoke the skill:
```
/ui-ux-pro-max
```

This gives you:
- A design direction (style, palette, font pairing) tailored to the product type
- 161 color palettes, 57 font pairings, 50+ styles to choose from
- UX guidelines for 161 product types
- Prevents defaulting to "developer defaults"

**When to invoke:**
- Starting a new page or major section
- When you feel the UI looks generic but don't know why
- When you need to choose a visual direction for a feature

---

## How to Use the frontend-design Skill

```
/frontend-design
```

This skill handles implementation — translating the design direction into actual code with:
- Production-grade component structure
- Correct Tailwind usage (no arbitrary values unless necessary)
- Framer Motion for intentional animation
- Accessibility baked in

**Workflow:**
1. `/ui-ux-pro-max` → get design direction and rationale
2. `/frontend-design` → implement it with that direction in mind
3. Refine from there — the AI gives you a foundation, not a finished product

---

## Design Principles (Non-Negotiables)

### Typography First
Type carries the most weight. Pick one display font and one body font — not three.
- Display: something with character (Playfair Display, Clash Display, Syne, Space Grotesk)
- Body: legible at small sizes (Inter, DM Sans, Geist, Plus Jakarta Sans)
- Use font size and weight contrast to create hierarchy — don't rely on color alone

### Whitespace is the Design
Cramped UIs feel low-quality regardless of other choices. Be generous with padding.
- Sections: `py-24` to `py-32` on desktop, not `py-8`
- Between elements: let them breathe
- Cards: `p-6` to `p-8`, not `p-4`

### Color with Restraint
Pick one accent color and use it sparingly. Everything else is neutrals.
- Not: blue buttons, blue headings, blue icons, blue borders
- Yes: one blue CTA button; everything else is black/white/gray
- Dark mode isn't optional if your product targets developers

### No Decoration Without Purpose
Gradients, blurs, glows, and animated backgrounds are fine if they serve a purpose.
If you can't explain why an element is there, remove it.

### Contrast and Hierarchy
Every screen needs a clear answer to: "What should I look at first?"
- One primary action per screen
- Heading hierarchy: one `<h1>`, supporting `<h2>`s, never competing `<h1>`s
- Visual weight guides the eye: large → medium → small

---

## Patterns That Actually Work

### Hero Section
Instead of a centered gradient blob with one heading:
- Asymmetric layout (text left, visual right)
- Show the actual product (screenshot, video, live demo) — not abstract shapes
- Headline that says what the product *does*, not what it *is*
- Secondary headline that says who it's *for*

### Feature Sections
Instead of three identical icon cards:
- Alternate layout direction (text/visual, then visual/text)
- One feature gets the spotlight, others support it
- Show the feature in context (a real UI, a real data example)

### Pricing
Instead of three identical cards:
- Highlight the recommended tier (border, badge, slightly larger)
- Use a toggle for monthly/annual
- Show the math: "Save $X/year"

### Empty States
Don't show nothing. Show:
- An illustration or icon
- A clear explanation of why it's empty
- A call to action to fill it ("Connect your first service →")

---

## Before Shipping Any New Page

- [ ] Does each section have a clear visual hierarchy?
- [ ] Is there one dominant action per screen?
- [ ] Does the font pairing have contrast (display vs. body weight/style)?
- [ ] Are you using the accent color sparingly?
- [ ] Does it look good in dark mode?
- [ ] Is the mobile layout intentional (not just "it fits")?
- [ ] Does it show the actual product, not just describe it?
- [ ] Would a designer cringe at the spacing?

---

## Resources to Reference Before Designing

- [Refactoring UI](https://www.refactoringtailwind.com/) — the book that the Tailwind authors wrote; most common UI mistakes and fixes
- [Vercel's design system](https://vercel.com/design) — dark, high-contrast, developer-native aesthetic
- [Linear's landing page](https://linear.app) — how to do sparse, high-quality developer product design
- [Rauno's components](https://rauno.me) — micro-interactions done right
