# RAG Support Copilot

An AI-powered support ticket resolution system using Retrieval-Augmented Generation (RAG). Upload your support documentation, ask about any issue, and receive structured resolution cards with possible causes, recommended steps, urgency levels, and source citations — all streamed live.

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
│  │  - Chroma add  │   │  - HF Router → DeepSeek-V3 stream    │  │
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
| 3 | Typos in query | `TYPO_MAP` with 24 regex patterns; corrected query shown to user |
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
```env
HF_API_KEY=hf_your_key_here
```

Create `frontend/.env.local`:
```bash
cp frontend/.env.local.template frontend/.env.local
# Edit NEXT_PUBLIC_BACKEND_URL if your backend runs on a different port
```

### 2. Start the backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

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
3. Upload `.txt` or `.md` support documents via the sidebar drop zone
4. Ask about any support issue in the chat

---

## Project Structure

```
LLM-Pipeline/
├── backend/
│   ├── server.py          # FastAPI: ingest, query SSE, status
│   ├── requirements.txt
│   └── chroma_db/         # auto-created at runtime
├── frontend/
│   ├── app/
│   │   ├── page.tsx       # entry point → ChatInterface
│   │   ├── layout.tsx
│   │   └── globals.css    # dark theme CSS variables
│   ├── components/
│   │   ├── ChatInterface.tsx   # main client component, SSE state
│   │   ├── Sidebar.tsx         # API key, strict mode, upload, status
│   │   ├── MessageBubble.tsx   # user/assistant bubbles
│   │   ├── ResolutionCard.tsx  # urgency badge, steps, sentiment
│   │   └── SourcesSection.tsx  # collapsible retrieved chunks
│   ├── lib/
│   │   ├── types.ts       # shared TypeScript types
│   │   ├── sse.ts         # fetch + ReadableStream SSE consumer
│   │   └── api.ts         # ingest, status API wrappers
│   └── .env.local.template
└── README.md
```

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

Set `HF_API_KEY` in Space secrets. Update `NEXT_PUBLIC_BACKEND_URL` in Vercel env vars.

### Backend → Railway

1. Push `backend/` to a GitHub repo
2. Create Railway project → connect repo
3. Set `HF_API_KEY` environment variable
4. Railway auto-detects Python and runs `python server.py`

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_BACKEND_URL to your deployed backend URL in Vercel dashboard
```

---

## License

MIT
