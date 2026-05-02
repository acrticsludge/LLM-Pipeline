# Graphify Workflow

Graphify turns any folder of files into a navigable knowledge graph. Use it at the start of every project and after major structural changes.

---

## Installation

```bash
pip install graphifyy
```

If the `graphify` command isn't on PATH in bash, use Python directly:
```bash
python -m graphify <command>
```

## Running on a Project

In Claude Code, type:
```
/graphify
```
or for a specific path:
```
/graphify c:\path\to\project
```

This runs:
1. **AST extraction** (deterministic, instant) — code structure, imports, calls
2. **Semantic extraction** (LLM, token cost) — docs, concepts, relationships across files
3. **Community detection** — Louvain algorithm groups related concepts
4. **Output generation** — `graphify-out/graph.json`, `graph.html`, `GRAPH_REPORT.md`

## Windows Encoding Fix

If you see `UnicodeEncodeError: 'charmap' codec can't encode character` during report generation, the fix is to ensure `encoding='utf-8'` is passed to any `Path.write_text()` calls in the graphify library. The graph.json and graph.html are fine; it's the GRAPH_REPORT.md that hits this.

Workaround: open `GRAPH_REPORT.md` in VS Code (it reads UTF-8 fine even if the terminal errored).

## Install Git Hook (Auto-Rebuild)

After the initial run, install the post-commit hook:
```bash
python -m graphify hook install
```

This creates `.git/hooks/post-commit` that:
- On code-only changes: rebuilds the graph instantly (AST only, no LLM)
- On doc/image changes: flags for manual `--update`

## Reading the Outputs

### `graphify-out/GRAPH_REPORT.md`
- **God nodes** — most-connected concepts; these are your architectural load-bearing points
- **Communities** — clusters of tightly related concepts; understand one community at a time
- **Surprising connections** — inferred edges between concepts that don't directly reference each other
- **Hyperedges** — groups of 3+ nodes that participate in a shared pattern (e.g., the alert pipeline)

### `graphify-out/graph.html`
- Open in a browser — no server needed
- Color-coded by community; hover for node details; click to highlight connections

### `graphify-out/graph.json`
- Machine-readable; used by code-review-graph MCP for queries
- Survives across sessions — query it weeks later without re-reading files

## Querying (in Claude)

```
/graphify query "What is the path from a GitHub usage poll to a fired Slack alert?"
/graphify query "Which files are most risky to change?"
/graphify explain "pollCycle"
/graphify path "fetchGitHubUsage" "sendSlackAlert"
```

## Gitignore
Always add `/graphify-out` to `.gitignore` — it's a generated artifact, not source code.

## Token Cost
- Full run on ~190 files: ~2 semantic subagents, moderate token cost
- Subsequent runs with `--update`: only re-extracts changed files (uses cache)
- Code-only changes via git hook: zero LLM cost (AST only)
