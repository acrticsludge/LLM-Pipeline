# RAG Support Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack RAG Support Copilot with a FastAPI backend (Chroma + HuggingFace DeepSeek) and a Next.js 16 frontend with dark-themed chat UI, SSE streaming, and a sidebar for file ingestion and settings.

**Architecture:** FastAPI backend handles document ingestion into ChromaDB, embedding with SentenceTransformers, and RAG queries streamed via SSE using DeepSeek-V3 through the HuggingFace Router. The Next.js frontend consumes SSE via `fetch` + `ReadableStream` (not EventSource, since POST bodies are required), renders streaming text live, and displays a Resolution Card from the validated Pydantic model returned in the final SSE event.

**Tech Stack:** FastAPI, ChromaDB, sentence-transformers, OpenAI SDK (HF Router), Python-dotenv, Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, react-hook-form, zod, @hookform/resolvers

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/server.py` | Create | Full FastAPI server: models, ingest, query SSE, status |
| `backend/requirements.txt` | Create | Python deps |
| `frontend/lib/types.ts` | Create | Shared TypeScript types |
| `frontend/lib/sse.ts` | Create | SSE streaming utility (fetch + ReadableStream) |
| `frontend/lib/api.ts` | Create | Backend API call wrappers |
| `frontend/app/globals.css` | Modify | Dark theme CSS variables |
| `frontend/app/layout.tsx` | Modify | Update metadata title/description |
| `frontend/app/page.tsx` | Replace | Shell: import ChatInterface, no boilerplate |
| `frontend/components/ResolutionCard.tsx` | Create | Urgency badge, steps, sentiment, disclaimer |
| `frontend/components/SourcesSection.tsx` | Create | Collapsible retrieved chunks list |
| `frontend/components/MessageBubble.tsx` | Create | User/assistant chat bubbles |
| `frontend/components/Sidebar.tsx` | Create | API key, strict toggle, file upload, status |
| `frontend/components/ChatInterface.tsx` | Create | Main "use client" component; full chat state |
| `frontend/.env.local.template` | Create | NEXT_PUBLIC_BACKEND_URL placeholder |
| `README.md` | Replace | Full project README with ASCII diagram |

---

## Task 1: Backend requirements.txt + Pydantic models

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/server.py` (models section only — will extend in later tasks)

- [ ] **Step 1: Create backend/requirements.txt**

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
openai==1.59.4
pydantic==2.10.4
chromadb==0.6.3
sentence-transformers==3.3.1
python-dotenv==1.0.1
python-multipart==0.0.20
```

- [ ] **Step 2: Create backend/server.py with only the model/type definitions**

```python
from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Literal

import chromadb
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel, field_validator
from sentence_transformers import SentenceTransformer

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

SENTIMENT_MAP: dict[str, str] = {
    "frustrated": "negative", "angry": "negative", "upset": "negative",
    "unhappy": "negative", "bad": "negative", "terrible": "negative",
    "disappointed": "negative", "annoyed": "negative",
    "happy": "positive", "satisfied": "positive", "pleased": "positive",
    "great": "positive", "good": "positive", "excellent": "positive",
    "ok": "neutral", "okay": "neutral", "fine": "neutral",
}

URGENCY_MAP: dict[str, str] = {
    "emergency": "critical", "urgent": "high", "asap": "high",
    "moderate": "medium", "normal": "medium", "minor": "low",
    "low priority": "low",
}

TYPO_MAP: list[tuple[str, str]] = [
    (r"\berroe\b", "error"), (r"\bporblem\b", "problem"),
    (r"\bisseu\b", "issue"), (r"\bfaliure\b", "failure"),
    (r"\bconection\b", "connection"), (r"\bconfigration\b", "configuration"),
    (r"\binstalltion\b", "installation"), (r"\bautentication\b", "authentication"),
    (r"\bdatbase\b", "database"), (r"\bservor\b", "server"),
    (r"\btimeotu\b", "timeout"), (r"\btimout\b", "timeout"),
    (r"\bnetowrk\b", "network"), (r"\bnetork\b", "network"),
    (r"\bpassowrd\b", "password"), (r"\bpasword\b", "password"),
    (r"\bloign\b", "login"), (r"\bsingin\b", "signin"),
    (r"\brecieve\b", "receive"), (r"\boccured\b", "occurred"),
    (r"\bseperate\b", "separate"), (r"\bdefualt\b", "default"),
    (r"\bexeucte\b", "execute"), (r"\bperformace\b", "performance"),
]

FALLBACK_RESOLUTION = {
    "ticket_id": "UNKNOWN",
    "possible_cause": "Could not determine cause — query confidence too low.",
    "recommended_steps": [
        "Rephrase your question with more specific details.",
        "Ensure relevant documents have been ingested.",
        "Contact support if the issue persists.",
    ],
    "urgency": "medium",
    "sentiment": "neutral",
    "disclaimer": "Strict mode: confidence below threshold. Answer not generated.",
}

CHUNK_SIZE = 300
CHUNK_OVERLAP = 50
TOP_K = 3
CONFIDENCE_THRESHOLD = 0.6
MAX_RETRIES = 3
COLLECTION_NAME = "support_docs"
STATUS_FILE = Path("chroma_db/.status.json")


class Resolution(BaseModel):
    ticket_id: str = "UNKNOWN"
    possible_cause: str = "Unknown"
    recommended_steps: list[str] = []
    urgency: Literal["low", "medium", "high", "critical"] = "medium"
    sentiment: Literal["positive", "neutral", "negative"] = "neutral"
    disclaimer: str | None = None

    @field_validator("recommended_steps", mode="before")
    @classmethod
    def coerce_steps(cls, v: object) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [v]
        return v

    @field_validator("urgency", mode="before")
    @classmethod
    def normalize_urgency(cls, v: object) -> str:
        s = str(v).lower().strip() if v else "medium"
        if s in {"low", "medium", "high", "critical"}:
            return s
        mapped = URGENCY_MAP.get(s)
        if mapped:
            logger.info("Normalized urgency %r -> %r", s, mapped)
            return mapped
        logger.warning("Unknown urgency %r, defaulting to 'medium'", s)
        return "medium"

    @field_validator("sentiment", mode="before")
    @classmethod
    def normalize_sentiment(cls, v: object) -> str:
        s = str(v).lower().strip() if v else "neutral"
        if s in {"positive", "neutral", "negative"}:
            return s
        mapped = SENTIMENT_MAP.get(s)
        if mapped:
            logger.info("Normalized sentiment %r -> %r", s, mapped)
            return mapped
        logger.warning("Unknown sentiment %r, defaulting to 'neutral'", s)
        return "neutral"


class QueryRequest(BaseModel):
    question: str
    strict: bool = False
    api_key: str


class IngestResponse(BaseModel):
    chunks_stored: int
    filenames: list[str]


class StatusResponse(BaseModel):
    total_chunks: int
    last_ingestion: str | None
```

- [ ] **Step 3: Commit**

```
git add backend/requirements.txt backend/server.py
git commit -m "feat: add backend requirements and Pydantic models"
```

---

## Task 2: Backend — global state, startup, helpers

**Files:**
- Modify: `backend/server.py` (append after models)

- [ ] **Step 1: Append app init, startup, and helpers to server.py**

```python
# ---------------------------------------------------------------------------
# App + global state
# ---------------------------------------------------------------------------

app = FastAPI(title="RAG Support Copilot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_embedder: SentenceTransformer | None = None
_chroma_client: chromadb.PersistentClient | None = None
_collection: chromadb.Collection | None = None


@app.on_event("startup")
async def startup() -> None:
    global _embedder, _chroma_client, _collection
    logger.info("Loading SentenceTransformer…")
    _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("Initializing ChromaDB…")
    _chroma_client = chromadb.PersistentClient(path="chroma_db")
    _collection = _chroma_client.get_or_create_collection(COLLECTION_NAME)
    logger.info("Startup complete. Collection size: %d", _collection.count())


def get_collection() -> chromadb.Collection:
    if _collection is None:
        raise HTTPException(status_code=503, detail="Server not ready")
    return _collection


def get_embedder() -> SentenceTransformer:
    if _embedder is None:
        raise HTTPException(status_code=503, detail="Server not ready")
    return _embedder


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def chunk_text(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if c.strip()]


def normalize_query(query: str) -> tuple[str, str | None]:
    corrected = query
    for pattern, replacement in TYPO_MAP:
        corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
    return corrected, (corrected if corrected != query else None)


def repair_json(raw: str) -> str:
    raw = raw.strip()
    # strip markdown fences
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"```$", "", raw)
        raw = raw.strip()
    # close unclosed string
    if raw.count('"') % 2 != 0:
        raw += '"'
    # close unclosed braces/brackets
    opens = raw.count("{") - raw.count("}")
    closes = raw.count("[") - raw.count("]")
    raw += "]" * max(closes, 0) + "}" * max(opens, 0)
    return raw


def replace_nulls(obj: object) -> object:
    if isinstance(obj, dict):
        return {k: replace_nulls(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [replace_nulls(i) for i in obj]
    if obj is None:
        return "Unknown"
    return obj


def _load_status() -> dict:
    if STATUS_FILE.exists():
        try:
            return json.loads(STATUS_FILE.read_text())
        except Exception:
            pass
    return {"total_chunks": 0, "last_ingestion": None}


def _save_status(total: int) -> None:
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.write_text(
        json.dumps({"total_chunks": total, "last_ingestion": datetime.now(timezone.utc).isoformat()})
    )
```

- [ ] **Step 2: Commit**

```
git add backend/server.py
git commit -m "feat: backend app init, startup, helpers"
```

---

## Task 3: Backend — /ingest endpoint

**Files:**
- Modify: `backend/server.py` (append)

- [ ] **Step 1: Append /ingest endpoint**

```python
# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

@app.post("/ingest", response_model=IngestResponse)
async def ingest(files: list[UploadFile] = File(...)) -> IngestResponse:
    collection = get_collection()
    embedder = get_embedder()

    total_stored = 0
    filenames: list[str] = []

    for upload in files:
        name = upload.filename or "unknown"
        ext = Path(name).suffix.lower()
        if ext not in {".txt", ".md"}:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        raw = (await upload.read()).decode("utf-8", errors="replace")
        chunks = chunk_text(raw)

        if not chunks:
            continue

        embeddings = embedder.encode(chunks).tolist()
        ids = [f"{name}_{i}" for i in range(len(chunks))]
        metadatas = [{"filename": name, "chunk_index": i} for i in range(len(chunks))]

        collection.add(documents=chunks, embeddings=embeddings, ids=ids, metadatas=metadatas)
        total_stored += len(chunks)
        filenames.append(name)

    _save_status(collection.count())
    return IngestResponse(chunks_stored=total_stored, filenames=filenames)
```

- [ ] **Step 2: Commit**

```
git add backend/server.py
git commit -m "feat: backend /ingest endpoint"
```

---

## Task 4: Backend — /query SSE endpoint

**Files:**
- Modify: `backend/server.py` (append)

- [ ] **Step 1: Append /query endpoint**

```python
# ---------------------------------------------------------------------------
# POST /query  (SSE)
# ---------------------------------------------------------------------------

LLM_PROMPT_TEMPLATE = """\
You are a technical support AI. Based ONLY on the context below, answer the user's question.
Return a JSON object with EXACTLY these keys:
{{
  "ticket_id": "a short slug ID",
  "possible_cause": "one sentence root cause",
  "recommended_steps": ["step 1", "step 2", "step 3"],
  "urgency": "low|medium|high|critical",
  "sentiment": "positive|neutral|negative",
  "disclaimer": null
}}

Context:
{context}

Question: {question}
"""


async def _llm_stream(
    client: AsyncOpenAI,
    prompt: str,
    attempt: int = 0,
) -> AsyncGenerator[str, None]:
    try:
        stream = await client.chat.completions.create(
            model="deepseek-ai/DeepSeek-V3-0324",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=512,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as exc:
        if attempt < MAX_RETRIES - 1:
            wait = 2 ** attempt
            logger.warning("LLM error (attempt %d): %s — retrying in %ds", attempt + 1, exc, wait)
            import asyncio
            await asyncio.sleep(wait)
            async for token in _llm_stream(client, prompt, attempt + 1):
                yield token
        else:
            logger.error("LLM failed after %d attempts: %s", MAX_RETRIES, exc)
            raise


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/query")
async def query(req: QueryRequest) -> StreamingResponse:
    if not req.api_key:
        raise HTTPException(status_code=401, detail="HF_API_KEY required")

    collection = get_collection()
    embedder = get_embedder()

    corrected_question, corrected_query = normalize_query(req.question)

    query_embedding = embedder.encode([corrected_question]).tolist()[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(TOP_K, collection.count()),
        include=["documents", "distances", "metadatas"],
    )

    docs: list[str] = results["documents"][0] if results["documents"] else []
    distances: list[float] = results["distances"][0] if results["distances"] else []
    metadatas: list[dict] = results["metadatas"][0] if results["metadatas"] else []

    # Convert L2 distance to cosine-like confidence (smaller distance = higher confidence)
    def dist_to_confidence(d: float) -> float:
        return max(0.0, 1.0 - d / 2.0)

    sources = [
        {
            "content": doc,
            "score": round(dist_to_confidence(dist), 3),
            "filename": meta.get("filename", "unknown"),
        }
        for doc, dist, meta in zip(docs, distances, metadatas)
    ]

    top_confidence = sources[0]["score"] if sources else 0.0

    async def event_stream() -> AsyncGenerator[str, None]:
        # Strict mode low-confidence fallback
        if req.strict and top_confidence < CONFIDENCE_THRESHOLD:
            yield _sse(
                {
                    "type": "final",
                    "resolution": FALLBACK_RESOLUTION,
                    "sources": sources,
                    "corrected_query": corrected_query,
                }
            )
            return

        context = "\n---\n".join(docs) if docs else "No documents available."
        prompt = LLM_PROMPT_TEMPLATE.format(context=context, question=corrected_question)

        disclaimer: str | None = None
        if not docs:
            disclaimer = "No relevant documents found. Answer is based on general knowledge."

        llm_client = AsyncOpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=req.api_key,
        )

        full_text = ""
        try:
            async for token in _llm_stream(llm_client, prompt):
                full_text += token
                yield _sse({"type": "chunk", "content": token})
        except Exception as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return

        # Parse and validate
        try:
            repaired = repair_json(full_text)
            parsed = json.loads(repaired)
            cleaned = replace_nulls(parsed)
            if disclaimer:
                cleaned["disclaimer"] = disclaimer
            resolution = Resolution(**cleaned).model_dump()
        except Exception as exc:
            logger.error("Validation error: %s — raw: %s", exc, full_text[:200])
            resolution = {**FALLBACK_RESOLUTION, "disclaimer": f"Parse error: {exc}"}

        yield _sse(
            {
                "type": "final",
                "resolution": resolution,
                "sources": sources,
                "corrected_query": corrected_query,
            }
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 2: Commit**

```
git add backend/server.py
git commit -m "feat: backend /query SSE endpoint with RAG + LLM streaming"
```

---

## Task 5: Backend — /status endpoint + entry point

**Files:**
- Modify: `backend/server.py` (append)

- [ ] **Step 1: Append /status and main entry**

```python
# ---------------------------------------------------------------------------
# GET /status
# ---------------------------------------------------------------------------

@app.get("/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    collection = get_collection()
    saved = _load_status()
    return StatusResponse(
        total_chunks=collection.count(),
        last_ingestion=saved.get("last_ingestion"),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
```

- [ ] **Step 2: Commit**

```
git add backend/server.py
git commit -m "feat: backend /status endpoint and entry point"
```

---

## Task 6: Frontend — install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install packages**

Run from `frontend/` directory:

```bash
cd frontend
npm install react-hook-form zod @hookform/resolvers
```

- [ ] **Step 2: Verify package.json has new deps**

Expected additions in `dependencies`:
```json
"@hookform/resolvers": "^3.x.x",
"react-hook-form": "^7.x.x",
"zod": "^3.x.x"
```

- [ ] **Step 3: Commit**

```
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add react-hook-form, zod, @hookform/resolvers"
```

---

## Task 7: Frontend — TypeScript types (lib/types.ts)

**Files:**
- Create: `frontend/lib/types.ts`

- [ ] **Step 1: Create lib/types.ts**

```typescript
export type Urgency = "low" | "medium" | "high" | "critical";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Resolution {
  ticket_id: string;
  possible_cause: string;
  recommended_steps: string[];
  urgency: Urgency;
  sentiment: Sentiment;
  disclaimer: string | null;
}

export interface Source {
  content: string;
  score: number;
  filename: string;
}

export interface SSEChunkEvent {
  type: "chunk";
  content: string;
}

export interface SSEFinalEvent {
  type: "final";
  resolution: Resolution;
  sources: Source[];
  corrected_query: string | null;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = SSEChunkEvent | SSEFinalEvent | SSEErrorEvent;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  resolution?: Resolution;
  sources?: Source[];
  corrected_query?: string | null;
  isStreaming?: boolean;
  error?: string;
}

export interface IngestResponse {
  chunks_stored: number;
  filenames: string[];
}

export interface StatusResponse {
  total_chunks: number;
  last_ingestion: string | null;
}
```

- [ ] **Step 2: Commit**

```
git add frontend/lib/types.ts
git commit -m "feat: frontend TypeScript types"
```

---

## Task 8: Frontend — SSE streaming utility (lib/sse.ts)

**Files:**
- Create: `frontend/lib/sse.ts`

- [ ] **Step 1: Create lib/sse.ts**

```typescript
import type { SSEEvent } from "./types";

export async function* streamSSE(
  url: string,
  body: Record<string, unknown>
): AsyncGenerator<SSEEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          yield JSON.parse(raw) as SSEEvent;
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 2: Commit**

```
git add frontend/lib/sse.ts
git commit -m "feat: SSE streaming utility via fetch + ReadableStream"
```

---

## Task 9: Frontend — API wrappers (lib/api.ts)

**Files:**
- Create: `frontend/lib/api.ts`

- [ ] **Step 1: Create lib/api.ts**

```typescript
import type { IngestResponse, StatusResponse } from "./types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function ingestFiles(
  files: File[],
  apiKey: string
): Promise<IngestResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch(`${BACKEND}/ingest`, {
    method: "POST",
    body: form,
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Ingest failed (${res.status})`);
  }
  return res.json() as Promise<IngestResponse>;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BACKEND}/status`);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json() as Promise<StatusResponse>;
}

export function getQueryUrl(): string {
  return `${BACKEND}/query`;
}
```

- [ ] **Step 2: Commit**

```
git add frontend/lib/api.ts
git commit -m "feat: backend API wrappers"
```

---

## Task 10: Frontend — dark theme globals.css

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Replace globals.css**

```css
@import "tailwindcss";

:root {
  --background: #0d1117;
  --surface: #161b22;
  --surface-hover: #21262d;
  --border: #30363d;
  --foreground: #e6edf3;
  --muted: #8b949e;
  --accent: #58a6ff;
  --accent-hover: #79b8ff;
  --user-bubble: #1f6feb;
  --assistant-bubble: #161b22;
  --success: #3fb950;
  --warning: #d29922;
  --error: #f85149;
  --critical: #f85149;
  --high: #d29922;
  --medium: #58a6ff;
  --low: #3fb950;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

* {
  box-sizing: border-box;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--background);
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
```

- [ ] **Step 2: Commit**

```
git add frontend/app/globals.css
git commit -m "feat: dark theme CSS variables"
```

---

## Task 11: Frontend — ResolutionCard component

**Files:**
- Create: `frontend/components/ResolutionCard.tsx`

- [ ] **Step 1: Create components/ResolutionCard.tsx**

```typescript
import type { Resolution, Urgency, Sentiment } from "@/lib/types";

const urgencyConfig: Record<Urgency, { label: string; color: string }> = {
  critical: { label: "CRITICAL", color: "bg-[#f85149]/20 text-[#f85149] border-[#f85149]/40" },
  high:     { label: "HIGH",     color: "bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40" },
  medium:   { label: "MEDIUM",   color: "bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/40" },
  low:      { label: "LOW",      color: "bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/40" },
};

const sentimentEmoji: Record<Sentiment, string> = {
  positive: "😊",
  neutral:  "😐",
  negative: "😟",
};

interface Props {
  resolution: Resolution;
}

export default function ResolutionCard({ resolution }: Props) {
  const urgency = urgencyConfig[resolution.urgency] ?? urgencyConfig.medium;
  const emoji = sentimentEmoji[resolution.sentiment] ?? "😐";

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-hover)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--muted)]">#{resolution.ticket_id}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${urgency.color}`}>
            {urgency.label}
          </span>
        </div>
        <span className="text-lg" title={`Sentiment: ${resolution.sentiment}`}>{emoji}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Possible cause */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Possible Cause
          </p>
          <p className="text-sm text-[var(--foreground)]">{resolution.possible_cause}</p>
        </div>

        {/* Steps */}
        {resolution.recommended_steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
              Recommended Steps
            </p>
            <ol className="space-y-1">
              {resolution.recommended_steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="flex-shrink-0 text-[var(--accent)] font-mono">{i + 1}.</span>
                  <span className="text-[var(--foreground)]">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Disclaimer */}
        {resolution.disclaimer && (
          <div className="rounded border border-[#d29922]/40 bg-[#d29922]/10 px-3 py-2">
            <p className="text-xs text-[#d29922]">⚠ {resolution.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add frontend/components/ResolutionCard.tsx
git commit -m "feat: ResolutionCard component"
```

---

## Task 12: Frontend — SourcesSection component

**Files:**
- Create: `frontend/components/SourcesSection.tsx`

- [ ] **Step 1: Create components/SourcesSection.tsx**

```typescript
"use client";

import { useState } from "react";
import type { Source } from "@/lib/types";

interface Props {
  sources: Source[];
}

export default function SourcesSection({ sources }: Props) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
      >
        <span className="font-mono">{open ? "▾" : "▸"}</span>
        {sources.length} source{sources.length !== 1 ? "s" : ""} retrieved
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((src, i) => (
            <div
              key={i}
              className="rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-[var(--accent)] truncate max-w-[70%]">
                  {src.filename}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    src.score >= 0.7
                      ? "text-[#3fb950]"
                      : src.score >= 0.4
                      ? "text-[#d29922]"
                      : "text-[#f85149]"
                  }`}
                >
                  {(src.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] line-clamp-3 leading-relaxed">
                {src.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add frontend/components/SourcesSection.tsx
git commit -m "feat: SourcesSection collapsible component"
```

---

## Task 13: Frontend — MessageBubble component

**Files:**
- Create: `frontend/components/MessageBubble.tsx`

- [ ] **Step 1: Create components/MessageBubble.tsx**

```typescript
import type { Message } from "@/lib/types";
import ResolutionCard from "./ResolutionCard";
import SourcesSection from "./SourcesSection";

interface Props {
  message: Message;
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Role label */}
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1 px-1">
          {isUser ? "You" : "Copilot"}
        </span>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-[var(--user-bubble)] text-white rounded-tr-sm"
              : "bg-[var(--assistant-bubble)] border border-[var(--border)] text-[var(--foreground)] rounded-tl-sm"
          }`}
        >
          {message.isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-0.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        {/* Error */}
        {message.error && (
          <div className="mt-2 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs text-[#f85149]">
            ⚠ {message.error}
          </div>
        )}

        {/* Corrected query notice */}
        {message.corrected_query && (
          <p className="mt-1 px-1 text-xs text-[var(--muted)] italic">
            Searched as: <span className="text-[var(--accent)]">{message.corrected_query}</span>
          </p>
        )}

        {/* Resolution card — shown after streaming completes */}
        {!message.isStreaming && message.resolution && (
          <div className="w-full max-w-none">
            <ResolutionCard resolution={message.resolution} />
          </div>
        )}

        {/* Sources */}
        {!message.isStreaming && message.sources && (
          <div className="px-1 w-full">
            <SourcesSection sources={message.sources} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add frontend/components/MessageBubble.tsx
git commit -m "feat: MessageBubble component with streaming cursor"
```

---

## Task 14: Frontend — Sidebar component

**Files:**
- Create: `frontend/components/Sidebar.tsx`

- [ ] **Step 1: Create components/Sidebar.tsx**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ingestFiles, fetchStatus } from "@/lib/api";
import type { StatusResponse } from "@/lib/types";

const settingsSchema = z.object({
  apiKey: z.string().min(1, "API key required"),
});
type SettingsForm = z.infer<typeof settingsSchema>;

interface Props {
  onSettingsChange: (apiKey: string, strict: boolean) => void;
}

export default function Sidebar({ onSettingsChange }: Props) {
  const [strict, setStrict] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [ingestState, setIngestState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [ingestMessage, setIngestMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      apiKey:
        typeof window !== "undefined"
          ? (localStorage.getItem("hf_api_key") ?? "")
          : "",
    },
  });

  const apiKey = watch("apiKey");

  // Persist key and propagate changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hf_api_key", apiKey);
    }
    onSettingsChange(apiKey, strict);
  }, [apiKey, strict, onSettingsChange]);

  // Poll status every 30s
  useEffect(() => {
    const load = () =>
      fetchStatus()
        .then(setStatus)
        .catch((e: unknown) =>
          setStatusError(e instanceof Error ? e.message : "Status unavailable")
        );
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (!apiKey) {
      setIngestMessage("Enter your API key first.");
      setIngestState("error");
      return;
    }
    setIngestState("loading");
    setIngestMessage("");
    try {
      const res = await ingestFiles(files, apiKey);
      setIngestMessage(
        `Stored ${res.chunks_stored} chunks from ${res.filenames.join(", ")}`
      );
      setIngestState("success");
      fetchStatus().then(setStatus).catch(() => null);
    } catch (err) {
      setIngestMessage(err instanceof Error ? err.message : "Ingest failed");
      setIngestState("error");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <aside className="w-72 flex-shrink-0 h-full border-r border-[var(--border)] bg-[var(--surface)] flex flex-col gap-6 p-5 overflow-y-auto">
      {/* Title */}
      <div>
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          RAG Support Copilot
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">Powered by DeepSeek + ChromaDB</p>
      </div>

      <hr className="border-[var(--border)]" />

      {/* API Key */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Hugging Face API Key
        </label>
        <input
          type="password"
          placeholder="hf_..."
          className="w-full rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          {...register("apiKey")}
        />
        {errors.apiKey && (
          <p className="mt-1 text-xs text-[#f85149]">{errors.apiKey.message}</p>
        )}
        {!apiKey && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Required to query the LLM.
          </p>
        )}
      </div>

      {/* Strict mode */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Strict Mode
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Skip LLM if confidence &lt; 60%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStrict((s) => !s)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            strict ? "bg-[var(--accent)]" : "bg-[var(--border)]"
          }`}
          aria-pressed={strict}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              strict ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <hr className="border-[var(--border)]" />

      {/* File upload */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Ingest Documents
        </p>
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-6 cursor-pointer hover:border-[var(--accent)] transition-colors ${
            ingestState === "loading" ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <span className="text-2xl">
            {ingestState === "loading"
              ? "⏳"
              : ingestState === "success"
              ? "✅"
              : ingestState === "error"
              ? "❌"
              : "📄"}
          </span>
          <span className="text-xs text-[var(--muted)] text-center">
            {ingestState === "loading"
              ? "Ingesting…"
              : "Drop .txt or .md files here, or click"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            multiple
            className="sr-only"
            onChange={handleUpload}
          />
        </label>
        {ingestMessage && (
          <p
            className={`mt-2 text-xs ${
              ingestState === "error" ? "text-[#f85149]" : "text-[#3fb950]"
            }`}
          >
            {ingestMessage}
          </p>
        )}
      </div>

      <hr className="border-[var(--border)]" />

      {/* Status */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Index Status
        </p>
        {statusError ? (
          <p className="text-xs text-[#f85149]">{statusError}</p>
        ) : status ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">Chunks stored</span>
              <span className="font-mono text-[var(--accent)]">{status.total_chunks}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">Last ingestion</span>
              <span className="font-mono text-[var(--foreground)] text-[10px]">
                {status.last_ingestion
                  ? new Date(status.last_ingestion).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```
git add frontend/components/Sidebar.tsx
git commit -m "feat: Sidebar with API key, strict mode, file upload, status"
```

---

## Task 15: Frontend — ChatInterface (main client component)

**Files:**
- Create: `frontend/components/ChatInterface.tsx`

- [ ] **Step 1: Create components/ChatInterface.tsx**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar from "./Sidebar";
import MessageBubble from "./MessageBubble";
import { streamSSE } from "@/lib/sse";
import { getQueryUrl } from "@/lib/api";
import type { Message } from "@/lib/types";

const chatSchema = z.object({
  question: z.string().min(1),
});
type ChatForm = z.infer<typeof chatSchema>;

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [strict, setStrict] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChatForm>({
    resolver: zodResolver(chatSchema),
  });

  const handleSettingsChange = useCallback((key: string, strictMode: boolean) => {
    setApiKey(key);
    setStrict(strictMode);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSubmit({ question }: ChatForm) {
    if (!apiKey) return;
    setBackendError(null);
    reset();

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    try {
      for await (const event of streamSSE(getQueryUrl(), {
        question,
        strict,
        api_key: apiKey,
      })) {
        if (event.type === "chunk") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + event.content }
                : m
            )
          );
        } else if (event.type === "final") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: false,
                    content: m.content,
                    resolution: event.resolution,
                    sources: event.sources,
                    corrected_query: event.corrected_query,
                  }
                : m
            )
          );
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, error: event.message }
                : m
            )
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      setBackendError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: msg }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  const canSend = !!apiKey && !isLoading;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar onSettingsChange={handleSettingsChange} />

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-4xl">🤖</p>
                <p className="text-[var(--foreground)] font-medium">
                  RAG Support Copilot
                </p>
                <p className="text-sm text-[var(--muted)] max-w-sm">
                  Upload your support documentation in the sidebar, then ask
                  about any issue.
                </p>
                {!apiKey && (
                  <p className="text-xs text-[#d29922] mt-2">
                    ⚠ Enter your Hugging Face API key in the sidebar to get started.
                  </p>
                )}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {backendError && (
            <div className="mx-auto max-w-md rounded border border-[#f85149]/40 bg-[#f85149]/10 px-4 py-3 text-sm text-[#f85149] text-center">
              ⚠ {backendError}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex gap-3 items-end"
          >
            <div className="flex-1">
              <textarea
                rows={1}
                placeholder={
                  !apiKey
                    ? "Enter your API key in the sidebar first…"
                    : "Describe the support issue…"
                }
                disabled={!apiKey || isLoading}
                className="w-full resize-none rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50 leading-relaxed max-h-40 overflow-y-auto"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
                {...register("question")}
              />
              {errors.question && (
                <p className="mt-1 text-xs text-[#f85149]">
                  {errors.question.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSend}
              className="flex-shrink-0 h-11 w-11 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              )}
            </button>
          </form>
          <p className="mt-2 text-[10px] text-[var(--muted)] text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add frontend/components/ChatInterface.tsx
git commit -m "feat: ChatInterface main client component with SSE streaming"
```

---

## Task 16: Frontend — app/page.tsx + app/layout.tsx

**Files:**
- Replace: `frontend/app/page.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```typescript
import ChatInterface from "@/components/ChatInterface";

export default function Page() {
  return <ChatInterface />;
}
```

- [ ] **Step 2: Update app/layout.tsx metadata**

Change only the `metadata` export (keep fonts and everything else as-is):

```typescript
export const metadata: Metadata = {
  title: "RAG Support Copilot",
  description: "AI-powered support ticket resolution using RAG + DeepSeek",
};
```

Also add `suppressHydrationWarning` to `<html>` since localStorage reads can cause hydration mismatch:

```typescript
<html
  lang="en"
  suppressHydrationWarning
  className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
>
```

- [ ] **Step 3: Commit**

```
git add frontend/app/page.tsx frontend/app/layout.tsx
git commit -m "feat: update page and layout for RAG Copilot"
```

---

## Task 17: Frontend — .env.local.template

**Files:**
- Create: `frontend/.env.local.template`

- [ ] **Step 1: Create template**

```
# Copy to .env.local and fill in values
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

- [ ] **Step 2: Commit**

```
git add frontend/.env.local.template
git commit -m "chore: add .env.local.template"
```

---

## Task 18: Root README.md

**Files:**
- Replace: `README.md`

- [ ] **Step 1: Replace README.md**

```markdown
# RAG Support Copilot

An AI-powered support ticket resolution system using Retrieval-Augmented Generation (RAG). Upload your support documentation, ask about any issue, and receive structured resolution cards with possible causes, recommended steps, urgency levels, and source citations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌──────────────┐   ┌────────────────────────────────────────┐  │
│  │   Sidebar    │   │           Chat Interface                │  │
│  │  - API Key   │   │  Messages (SSE stream → Resolution Card)│  │
│  │  - Strict    │   │  Sources (collapsible, with scores)     │  │
│  │  - Upload    │   │  Input bar (react-hook-form + zod)      │  │
│  │  - Status    │   └────────────────────────────────────────┘  │
│  └──────┬───────┘                │                              │
└─────────│────────────────────────│──────────────────────────────┘
          │ POST /ingest           │ POST /query (SSE)
          │ GET /status            │
┌─────────▼────────────────────────▼──────────────────────────────┐
│                     FastAPI Backend                              │
│  ┌────────────────┐   ┌──────────────────────────────────────┐  │
│  │  /ingest       │   │  /query                              │  │
│  │  - Chunk text  │   │  - Typo-normalize query              │  │
│  │  - SentTrans.  │   │  - Embed + Chroma similarity search  │  │
│  │    embed       │   │  - Strict mode confidence check      │  │
│  │  - Chroma add  │   │  - HF Router → DeepSeek-V3 stream   │  │
│  └────────────────┘   │  - Retry w/ exponential backoff      │  │
│  ┌────────────────┐   │  - JSON repair + Pydantic validate   │  │
│  │  /status       │   │  - SSE: chunks → final Resolution    │  │
│  └────────────────┘   └──────────────────────────────────────┘  │
│                                    │                             │
│         ┌──────────────────────────┼────────────────┐           │
│         ▼                          ▼                ▼           │
│  ┌─────────────┐   ┌────────────────────┐  ┌──────────────┐    │
│  │  ChromaDB   │   │ SentenceTransformer│  │ HF Router    │    │
│  │  (persist)  │   │ all-MiniLM-L6-v2   │  │ DeepSeek-V3  │    │
│  └─────────────┘   └────────────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

- **Streaming responses** — SSE from FastAPI, consumed via `fetch` + `ReadableStream`; text streams live before the Resolution Card appears.
- **Resolution Cards** — Structured JSON output validated via Pydantic: urgency badge, sentiment emoji, recommended steps, disclaimer.
- **Source citations** — Top-K retrieved chunks shown with similarity scores; collapsible per message.
- **File ingestion** — Upload `.txt` / `.md` files; chunked (300 chars, 50 overlap), embedded locally, stored in ChromaDB.
- **Strict mode** — Skips LLM if top retrieval confidence < 60%, returns fallback resolution.

### Edge Cases Handled

| # | Edge Case | Handling |
|---|-----------|----------|
| 1 | Null fields from LLM | `replace_nulls()` replaces all `None` → `"Unknown"` before Pydantic |
| 2 | Truncated JSON | `repair_json()` closes unclosed strings, braces, brackets |
| 3 | Typos in query | `TYPO_MAP` with 22+ regex patterns; corrected query shown to user |
| 4 | Empty document DB | LLM still called; `disclaimer` field set in response |
| 5 | Rate limits (429) | Exponential backoff, up to 3 retries |
| 6 | Low confidence strict mode | Returns `FALLBACK_RESOLUTION` without LLM call |
| 7 | Invalid urgency enum | `URGENCY_MAP` normalizes "urgent"→"high", "emergency"→"critical", etc. |
| 8 | Invalid sentiment enum | `SENTIMENT_MAP` normalizes "frustrated"→"negative", "happy"→"positive", etc. |
| 9 | `recommended_steps` as string | Pydantic `coerce_steps` validator wraps in list |
| 10 | No API key | Backend returns 401; frontend disables send button with warning |
| 11 | Backend unreachable | Frontend catches fetch error, shows inline error message |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Clone & configure

```bash
git clone <repo>
cd LLM-Pipeline
```

Create `backend/.env`:
```
HF_API_KEY=hf_your_key_here
```

Create `frontend/.env.local` from template:
```bash
cp frontend/.env.local.template frontend/.env.local
# Edit NEXT_PUBLIC_BACKEND_URL if needed
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
python server.py
# → http://localhost:8000
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. Use it

1. Open `http://localhost:3000`
2. Enter your Hugging Face API key in the sidebar
3. Upload `.txt` or `.md` support documents
4. Ask about any support issue

---

## Deployment

### Backend → Hugging Face Spaces (Docker)

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY server.py .
EXPOSE 7860
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
```

Set `HF_API_KEY` in Space secrets.

### Backend → Railway

1. Push `backend/` to a GitHub repo
2. Create Railway project, connect repo
3. Set `HF_API_KEY` environment variable
4. Railway auto-detects Python and runs `python server.py`

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_BACKEND_URL to your deployed backend URL
```

---

## License

MIT
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs: comprehensive README with architecture diagram"
```

---

## Self-Review: Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| POST /ingest — chunking, embedding, Chroma | Task 3 |
| POST /query — SSE, top_k=3, confidence, LLM | Task 4 |
| GET /status — chunks, last_ingestion | Task 5 |
| Retry w/ exponential backoff | Task 4 (\_llm\_stream) |
| Null → defaults | Task 2 (replace_nulls) |
| Truncated JSON repair | Task 2 (repair_json) |
| Empty DB disclaimer | Task 4 |
| Strict mode fallback | Task 4 |
| Urgency/sentiment enum normalization | Task 1 (field_validators) |
| Typo normalization | Task 2 (normalize_query) |
| CORS | Task 2 (app startup) |
| HF_API_KEY env var | Task 4 (per-request api_key) |
| Chat interface + SSE streaming | Task 15 |
| Sidebar: API key, strict, upload, status | Task 14 |
| Resolution Card | Task 11 |
| Sources collapsible | Task 12 |
| No API key → disable send + warning | Task 15 |
| Spinner during loading | Task 15 |
| Backend unreachable error | Task 15 |
| Corrected query display | Task 13 |
| Dark theme | Task 10 |
| Responsive layout | Tasks 11–15 (Tailwind) |
| .env.local.template | Task 17 |
| README | Task 18 |

All requirements covered. No placeholders remain in the plan.
