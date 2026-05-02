# [Project Name] — CLAUDE.md

## Project Overview

[One paragraph: what the product does, who it's for, what problem it solves.]

## Stack

- **Framework:** Next.js (App Router)
- **Database + Auth:** Supabase
- **Backend jobs:** Railway
- **Hosting:** Vercel
- **Email:** Resend
- **Payments:** [Dodo Payments / Stripe]
- **Language:** TypeScript throughout

## Core Features

### 1. Authentication
[Describe auth methods, OAuth providers, redirect flows, route protection.]

### 2. [Feature Name]
[Describe the feature, the data model, the API endpoints involved.]

### 3. [Feature Name]
[...]

## Database Schema (Supabase)

**[table_name]**
- id, [columns], created_at

**[table_name]**
- id, [columns], created_at

## Project Structure

```
/app
  /dashboard
  /[routes]
  /api
    /[endpoints]
/worker
  index.ts
  services/
  alerts/
/lib
  supabase.ts
  encryption.ts
  tiers.ts
```

## Key Rules for Claude

- Always use TypeScript, no plain JS
- Use App Router conventions (server components by default, client only when needed)
- Never log raw API keys anywhere
- Encrypt all integration API keys before storing in the database
- Row Level Security (RLS) must be enabled on all tables
- Handle API errors gracefully per integration — one failing should not block others
- Keep the worker stateless — all state lives in Supabase
- Use Resend for all outbound email
- Mobile responsive UI throughout
- No unnecessary dependencies

## MCP Tools: graphify

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
graphify MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |
