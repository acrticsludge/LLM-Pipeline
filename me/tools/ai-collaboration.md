# Multi-AI Collaboration

Pattern for using multiple AI coding tools on the same project without losing context or consistency.

---

## The Problem

Different AI tools read different config files. Claude Code reads `CLAUDE.md`. Cursor reads `.cursorrules`. Windsurf reads `.windsurfrules`. Gemini reads `GEMINI.md`. If you don't maintain all of them, some tools will have outdated context and give worse suggestions.

## The Solution: Keep All Files in Sync

Maintain the same content in all AI config files. They serve the same purpose — giving the AI assistant context about the project.

| File | Tool |
|------|------|
| `CLAUDE.md` | Claude Code (this) |
| `AGENTS.md` | Claude agent/agentic mode |
| `.cursorrules` | Cursor |
| `.windsurfrules` | Windsurf |
| `GEMINI.md` | Gemini |

**When you update CLAUDE.md, update all the others.** They should always have identical content except possibly for tool-specific sections (like the MCP tools block which is Claude-specific).

## What to Put In These Files

Every project's AI config file should contain:
1. **Project overview** — what it does, who it's for
2. **Stack** — exact technologies and versions
3. **Core features** — detailed enough that the AI understands the domain
4. **Database schema** — table names, key columns, relationships
5. **Key rules** — the non-negotiables (TypeScript, RLS, never log keys, etc.)
6. **Project structure** — folder layout
7. **MCP tools** (Claude-specific) — graphify instructions

## Claude-Specific: Memory System

Claude Code has a persistent memory system at `~/.claude/projects/<project>/memory/`. Use this for:
- User preferences discovered during the project
- Non-obvious decisions and their rationale
- Feedback given to Claude about how to work

Don't duplicate CLAUDE.md content in memory — memory is for things that aren't in the code or docs.

## Claude-Specific: Graphify

Set up in `CLAUDE.md` with the MCP tools block. Other AI tools (Cursor, Windsurf) don't support MCP — they rely on file reading instead. This is fine; the graph is primarily a Claude workflow optimization.

## Skill Invocation

Skills available in Claude Code via `/skill-name`:
- `/graphify` — build knowledge graph
- `/commit` — create a git commit
- Other skills visible in the Claude Code skill list

## Post-Commit Sync

After every commit, ask: **does any AI config file need updating?**

### What triggers an update

| Change made | What to update |
|-------------|----------------|
| New route, page, or API endpoint | Project Structure section |
| New table or column in Supabase | Database Schema section |
| New feature or significant behavior change | Core Features section |
| New dependency added | Stack section |
| New rule established (security, API design, etc.) | Key Rules section |
| New pricing tier or limit change | Pricing Tiers section |
| New environment variable needed | worker-env-template.md (in /me) |
| New folder or file structure pattern | project-structure.md (in /me) |

### What does NOT need an update

- Bug fixes that don't change behavior
- Refactors that don't change structure
- Style/formatting changes
- Test additions for existing features

### How to do it

1. After committing, read the diff (`git diff HEAD~1 HEAD`)
2. Cross-reference against the trigger table above
3. Update CLAUDE.md first, then copy the changed sections into `.cursorrules`, `.windsurfrules`, `GEMINI.md`, `AGENTS.md`
4. Commit the config update in the same session — don't let it drift

The AI config files are documentation. Stale docs are worse than no docs — the AI will confidently work from wrong information.

---

## Workflow Recommendation

| Task | Best Tool |
|------|----------|
| Architecture exploration, impact analysis | Claude Code (graph-aware) |
| Fast inline editing, autocomplete | Cursor or Windsurf |
| Code review, large refactors | Claude Code (agent mode) |
| Explaining code to a team | Any — Gemini is good for this |
| Generating tests | Claude Code or Cursor |
