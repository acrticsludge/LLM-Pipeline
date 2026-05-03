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
- **Intent Classification** — Distinguishes support tickets from casual/off-topic messages. Casual greetings ("hello", "what's up") are caught by pre-check and return a friendly message without LLM calls. Off-topic questions that pass pre-check are classified by the LLM and return a structured non-ticket response. Prevents LLM hallucinations on irrelevant inputs.

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
| 12 | Casual greeting ("hello") | Pre-check filter catches it; returns non-ticket message without LLM call (saves API credits) |
| 13 | Off-topic question ("do you like pizza?") | LLM classifies as non-ticket; returns friendly message to refocus on support issues |

---

## Backend Endpoints

### `POST /query` (SSE Stream)

Real-time streaming resolution with retrieval transparency.

**Request:**
```json
{ "question": "DB timeout issue", "strict": false, "api_key": "hf_..." }
```

**Response (Server-Sent Events):**

1. **Chunk events** (streaming LLM tokens):
```json
{"type": "chunk", "content": "The database timeout...", "confidence": 0.89, "sources": [...]}
```

2. **Done event** (final structured response):
```json
{
  "type": "done",
  "type_discrimination": "ticket",
  "resolution": {
    "possible_cause": "Query time limit exceeded",
    "recommended_steps": ["Increase timeout", "Check indexes"],
    "urgency": "high",
    "sentiment": "negative",
    "disclaimer": "Verify in your environment"
  },
  "sources": [{"content": "...", "score": 0.95, "filename": "db-guide.md"}],
  "confidence": 0.89,
  "corrected_query": "database timeout issue"
}
```

### `POST /ingest`

Chunk, embed, and store documents.

**Request:**
```
Content-Type: multipart/form-data
Authorization: Bearer hf_...
files: [support-docs.txt, faq.md]
```

**Response:**
```json
{ "chunks_stored": 42, "filenames": ["support-docs.txt", "faq.md"] }
```

### `GET /status`

Check document store health.

**Response:**
```json
{
  "total_chunks": 1250,
  "last_ingestion": "2026-05-03T12:34:56Z"
}
```

### `POST /feedback` (Optional)

Record user satisfaction for ML training.

**Request:**
```json
{ "question": "DB timeout issue", "feedback": "up" }
```

**Response:**
```json
{ "status": "recorded", "feedback_type": "up" }
```

### `GET /metrics` (Optional)

Analytics dashboard data.

**Response:**
```json
{
  "total_queries": 342,
  "total_feedback": {"up": 285, "down": 57},
  "avg_confidence": 0.82,
  "total_chunks_ingested": 1250
}
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Any modern browser (Chrome, Firefox, Safari, Edge)
- **Optional:** Node.js 18+ (only for Next.js frontend)

### Option A: Single-File HTML (Fastest)

```bash
# 1. Clone repo and configure
git clone <repo>
cd LLM-Pipeline

# 2. Create backend/.env
echo "HF_API_KEY=hf_your_key_here" > backend/.env

# 3. Start the backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python server.py
# → http://localhost:8000

# 4. Open copilot.html in your browser
# File → Open File → select copilot.html
# Or: open file:///<absolute-path>/LLM-Pipeline/copilot.html in browser
```

Then:
1. Enter your Hugging Face API key in the Settings panel
2. Upload `.txt` or `.md` documents via drop zone
3. Ask about any support issue

### Option B: Next.js Full-Stack Frontend

```bash
# 1-2. Same setup as above (backend .env)

# 3. Start the backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python server.py

# 4. In another terminal, start Next.js frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
LLM-Pipeline/
├── backend/
│   ├── server.py          # FastAPI: ingest, query SSE, status
│   ├── requirements.txt
│   └── chroma_db/         # auto-created at runtime
├── copilot.html           # Single-file React app (standalone)
│   ├── All React components (App, Sidebar, ChatInterface, etc)
│   ├── SSE streaming handler
│   ├── File upload (FormData /ingest)
│   └── Status polling (/status)
├── frontend/ (Optional: Next.js version)
│   ├── app/
│   │   ├── page.tsx       # entry point → ChatInterface
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ResolutionCard.tsx
│   │   └── SourcesSection.tsx
│   ├── lib/
│   │   ├── types.ts
│   │   ├── sse.ts
│   │   └── api.ts
│   └── .env.local.template
└── README.md
```

---

## Testing Intent Detection

### Non-Ticket Detection (Pre-Check)

These messages are caught by the pre-check and return immediately without calling the LLM:

- "hello" → Returns: "I'm a support copilot. Please describe a technical issue..."
- "hi there" → Returns: "I'm a support copilot. Please describe a technical issue..."
- "what's up" → Returns: "I'm a support copilot. Please describe a technical issue..."

### Non-Ticket Detection (LLM-Based)

These messages pass pre-check but are classified as non-tickets by the LLM:

- "when was your company founded?" → Returns: "I'm a support copilot. Please describe a technical issue..."
- "do you like pizza?" → Returns: "I'm a support copilot. Please describe a technical issue..."

### Legitimate Support Tickets

These are recognized as real support issues and return a Resolution Card:

- "My database keeps timing out during peak hours"
- "How do I fix a 502 error in my application?"
- "Application crashes on startup with seg fault"

---

## copilot.html Configuration

### Backend URL

Edit `copilot.html` line 312:
```javascript
const BACKEND_URL = 'http://localhost:8000';
```

Or change it dynamically in the Settings panel (⚙️ Collapsible → Backend URL).

### Browser Security Notes

- **Local file:** `file:///...` URLs block fetch requests. Use a simple HTTP server:
  ```bash
  # Python 3
  python -m http.server 8080
  # Open http://localhost:8080/copilot.html
  
  # Node.js (http-server)
  npx http-server .
  ```

- **CORS:** Backend must allow `http://localhost:3000` (or your frontend origin) in `server.py`:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000", "http://localhost:8080"],
      allow_methods=["*"],
      allow_headers=["*"],
  )
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
