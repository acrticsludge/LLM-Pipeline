# Frontend Libraries

Curated list of libraries I reach for. Each is here because it's proven, not just popular.

---

## Animation

### Framer Motion
```bash
npm install framer-motion
```
- Page transitions, layout animations, gesture-based interactions
- `<motion.div>` as a drop-in for any HTML element
- `AnimatePresence` for exit animations (modals, toasts, list items)
- `useScroll` + `useTransform` for scroll-driven effects
- Layout animation (`layoutId`) for shared element transitions between routes

**When to use:** Any animation that needs to feel polished — entrance/exit, hover lift, drag interactions. Not for micro-animations you can do with Tailwind `transition`.

**Don't use it for:** Simple CSS hover states, Tailwind transitions — Framer Motion has a runtime cost.

---

## Video Generation

### Remotion
```bash
npm install remotion @remotion/player
```
- Programmatic video composition in React
- `<Player>` component for in-browser preview and playback
- `useCurrentFrame()` + `interpolate()` for frame-based animation
- Render to MP4 via Remotion CLI or Remotion Lambda (cloud render)
- Great for: product demo videos, data visualization videos, personalized videos

**Typical structure:**
```
/video (or /remotion)
  Root.tsx          — registers all compositions
  MyComposition.tsx — one video per file
  package.json      — separate Remotion entry point
```

**Key gotchas:**
- Keep video logic separate from the main Next.js app — Remotion has its own bundler
- Use `<Sequence>` to layer clips in time; use `<Series>` for sequential clips
- `staticFile()` for assets — don't use relative paths inside compositions

---

## UI Components

### shadcn/ui
```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog
```
- Not a package — it copies component source directly into `components/ui/`
- Built on Radix UI primitives + Tailwind CSS
- Fully customizable — you own the code
- Covers: Button, Card, Dialog, Dropdown, Input, Select, Sheet, Table, Tabs, Toast, and 40+ more

**When to use:** Replaces hand-rolling Radix + Tailwind for common UI patterns. Faster than building from scratch, fully customizable unlike a traditional component library.

**Important:** After `npx shadcn@latest init`, components live in `components/ui/`. Modify them freely — they're yours.

---

## Forms

### react-hook-form + Zod
```bash
npm install react-hook-form zod @hookform/resolvers
```
- `react-hook-form` for form state, validation, submission
- `zod` for schema definition (reuse the same schema for API validation)
- `@hookform/resolvers` bridges the two

```ts
const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
```

---

## Icons

### Lucide React
```bash
npm install lucide-react
```
- 1,400+ clean, consistent icons
- Tree-shakeable — only imports what you use
- Used by shadcn/ui by default

---

## Data Fetching / State

### TanStack Query (React Query)
```bash
npm install @tanstack/react-query
```
- Server state management: caching, background refresh, loading/error states
- `useQuery` for reads, `useMutation` for writes
- Works alongside Next.js Server Components — use it for client-side data that needs real-time refresh

---

## Dates

### date-fns
```bash
npm install date-fns
```
- Tree-shakeable, functional, immutable
- `format`, `formatDistanceToNow`, `startOfMonth`, `addDays` — everything you need
- No prototype pollution (unlike moment.js)

---

## Utility

### clsx + tailwind-merge
```bash
npm install clsx tailwind-merge
```
Combine and deduplicate Tailwind classes safely:
```ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
This `cn()` util is standard in shadcn projects — put it in `lib/utils.ts`.

### Sonner (Toasts)
```bash
npm install sonner
```
- Minimal, beautiful toast notifications
- One-line usage: `toast.success("Saved!")`, `toast.error("Failed")`
- Already styled for dark/light mode

### react-hot-toast
```bash
npm install react-hot-toast
```
- Lightweight, customizable toasts
- Wrap app in `<Toaster />`, call `toast()` anywhere
- Built-in promise toasts: `toast.promise(fetch(...), { loading, success, error })`
- Custom render support: `toast.custom(<MyComponent />)`

**When to use:** Need promise-based toasts or custom toast UI. Sonner is simpler for basic use.

---

## Charts / Data Viz

### Recharts
```bash
npm install recharts
```
- React-native charting library
- `LineChart`, `BarChart`, `AreaChart` with composable sub-components
- Responsive with `<ResponsiveContainer>`
- Use for: usage history graphs, trend lines, bar comparisons

---

## Carousels / Sliders

### Embla Carousel
```bash
npm install embla-carousel-react
```
- Smooth, accessible, touch-friendly
- Used by shadcn/ui's Carousel component under the hood
- Minimal API — no heavy abstraction

---

## Quick Reference

| Need | Library |
|------|---------|
| Animations | `framer-motion` |
| Video generation | `remotion` |
| UI components | `shadcn/ui` (Radix + Tailwind) |
| Forms + validation | `react-hook-form` + `zod` |
| Icons | `lucide-react` |
| Client data fetching | `@tanstack/react-query` |
| Date formatting | `date-fns` |
| Class merging | `clsx` + `tailwind-merge` |
| Toasts | `sonner` or `react-hot-toast` |
| Charts | `recharts` |
| Carousels | `embla-carousel-react` |
| Themes (dark mode) | `next-themes` |
