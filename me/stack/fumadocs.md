# Fumadocs

Docs framework for Next.js App Router. Gives you MDX, sidebar navigation, search, and TOC out of the box with zero design debt.

---

## Packages

| Package | Role |
|---------|------|
| `fumadocs-ui` | UI components — sidebar, page layout, search dialog, MDX renderer |
| `fumadocs-mdx` | MDX compilation + Next.js plugin that generates `.source/` |
| `fumadocs-core` | Source loader, search server, tree builder |
| `@types/mdx` | TypeScript types for MDX imports |

```bash
npm install fumadocs-ui fumadocs-core fumadocs-mdx @types/mdx
```

**Version lock rule:** `fumadocs-ui` and `fumadocs-core` must be the same major version. `fumadocs-mdx` follows its own versioning but declares a peer dep range — check it.

---

## Setup (Next.js App Router)

### 1. next.config — must be `.mjs`, not `.ts`

`fumadocs-mdx` is ESM-only. Next.js's TypeScript config loader cannot import ESM-only packages. Rename `next.config.ts` → `next.config.mjs` and convert to ESM:

```mjs
import { createMDX } from 'fumadocs-mdx/next';

const nextConfig = {
  // your existing config...
};

export default createMDX()(nextConfig);
```

### 2. source.config.ts

Defines what content to compile. Lives at `frontend/source.config.ts` (project root, next to `next.config.mjs`):

```ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

export const docs = defineDocs({ dir: 'content/docs' });

export default defineConfig();
```

### 3. tsconfig.json — path alias

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "collections/*": ["./.source/*"]
    }
  }
}
```

This maps `import { docs } from 'collections/server'` → `.source/server` (the generated file).

### 4. lib/source.ts

```ts
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

### 5. package.json scripts — critical fix

`.source/` must exist before Next.js starts compiling. Add `fumadocs-mdx` as a pre-step:

```json
"dev": "fumadocs-mdx && next dev",
"build": "fumadocs-mdx && next build"
```

Without this, you get a chicken-and-egg `Module not found: Can't resolve 'collections/server'` error because the `.source/` folder doesn't exist yet when Next.js first tries to compile.

You can also run it manually to unblock:
```bash
node node_modules/fumadocs-mdx/dist/bin.js
```

### 6. globals.css

Add after `@import "tailwindcss"`:

```css
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";
```

Fumadocs uses `--fd-*` CSS variables — no conflict with `--color-*` custom tokens.

### 7. app/docs/layout.tsx

Scope `RootProvider` to `/docs` only — don't put it in the root layout:

```tsx
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';  // NOT 'fumadocs-ui/provider'
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout tree={source.getPageTree()} nav={{ title: 'My Docs' }}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
```

### 8. app/docs/[[...slug]]/page.tsx

```tsx
import { source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';

type Props = { params: Promise<{ slug?: string[] }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
```

### 9. app/api/search/route.ts

Fumadocs-internal endpoint — consumed by the built-in Cmd+K search dialog. Not a user-facing API, so no `{ data } / { error }` envelope:

```ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);
export const runtime = 'nodejs';
```

---

## Content structure

```
content/docs/
├── meta.json              ← root sidebar order
├── index.mdx              ← /docs (root page)
├── alert-config.mdx
└── services/
    ├── meta.json          ← services group order
    ├── github.mdx
    └── mongodb.mdx
```

### meta.json — sidebar ordering + separators

```json
{
  "pages": [
    "index",
    "---Service Setup---",
    "services",
    "---Reference---",
    "alert-config",
    "security-faq"
  ]
}
```

### Folder meta.json

```json
{
  "title": "Service Setup",
  "pages": ["github", "vercel", "supabase", "railway", "mongodb"]
}
```

### MDX frontmatter

```mdx
---
title: GitHub Actions
description: Track Actions minutes, runner breakdowns, and storage limits
---
```

---

## Middleware — no changes needed

If you use an explicit positive matcher in `middleware.ts`, `/docs/*` is naturally excluded:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"]
  // /docs/* not here → zero middleware invocations on docs pages
};
```

Never add `/docs` to the matcher — there's no auth or logic needed there.

---

## Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| `Module not found: collections/server` | `.source/` not generated before Next.js starts | Add `fumadocs-mdx &&` prefix to `dev` and `build` scripts |
| `Module not found: fumadocs-ui/provider` | That path doesn't exist in v16 | Use `fumadocs-ui/provider/next` |
| `fumadocs-mdx` is ESM-only | CommonJS config loader can't import it | Rename `next.config.ts` → `.mjs` |
| Search not working | `runtime = 'nodejs'` missing on search route | Add `export const runtime = 'nodejs'` |
| Sidebar order wrong | Default is alphabetical | Use `meta.json` with `pages` array |
