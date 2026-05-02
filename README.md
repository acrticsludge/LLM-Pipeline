# RAG Ticket Intelligence System

Production-ready Retrieval-Augmented Generation pipeline for support ticket resolution.  
Given a raw support ticket, the system retrieves similar historical tickets from a local vector store and generates a validated, structured resolution using DeepSeek-V4-Pro.

---

## Architecture

```
User Ticket Text
       │
       ▼
┌─────────────────┐
│ Query Pre-       │  typo correction, normalization
│ processor        │
└────────┬────────┘
         │ cleaned query
         ▼
┌─────────────────┐
│ SentenceTransfor │  all-MiniLM-L6-v2 (local, no API)
│ mer Embedder     │
└────────┬────────┘
         │ query vector
         ▼
┌─────────────────┐
│   ChromaDB       │  persistent vector store
│   Retrieval      │  top-3 nearest chunks
└────────┬────────┘
         │ context + confidence score
         ▼
┌─────────────────┐
│ Confidence Gate  │  distance > 0.8 → fallback (no LLM call)
└────────┬────────┘
         │ high-confidence context
         ▼
┌─────────────────┐
│ DeepSeek-V4-Pro  │  via Hugging Face Router (OpenAI-compatible)
│ (streaming)      │  3 retries, exponential backoff
└────────┬────────┘
         │ raw JSON string
         ▼
┌─────────────────┐
│ JSON Repair +    │  repair truncated output, sanitize nulls
│ Sanitizer        │
└────────┬────────┘
         │ clean dict
         ▼
┌─────────────────┐
│ Pydantic         │  Resolution schema, list→string coercion
│ Validation       │
└────────┬────────┘
         │
         ▼
    Resolution JSON
```

---

## Edge-Case Handling

| # | Edge Case | How It's Handled |
|---|-----------|-----------------|
| 1 | **Null fields** | `sanitize_data()` replaces any `None` field with a sensible default before Pydantic sees it |
| 2 | **List vs string** | `@field_validator("recommended_steps", mode="before")` joins lists with `\n` automatically |
| 3 | **Empty retrieval** | `collection.count() == 0` check skips LLM and returns `FALLBACK_RESOLUTION` |
| 4 | **Low-confidence retrieval** | Cosine distance > `DISTANCE_THRESHOLD` (0.8) → skip LLM, return fallback |
| 5 | **Truncated JSON** | `repair_json()` tries several closing suffixes; falls back gracefully if unrepairable |
| 6 | **Typos / messy queries** | `preprocess_query()` applies a regex correction map before embedding |
| 7 | **Unrelated queries** | Same distance gate as #4 — out-of-domain queries score > 0.8 distance |
| 8 | **Missing ingest warning** | `ingest_documents()` prints an actionable warning; `retrieve_context()` logs clearly |
| 9 | **Retry & rate-limit** | 3 attempts with exponential backoff (`2^attempt` seconds); doubles on 429 errors |
| 10 | **Truncation from short `max_tokens`** | `MAX_TOKENS = 1024` (raised from 512) |

---

## Setup

### 1. Install dependencies

```bash
pip install openai pydantic python-dotenv chromadb sentence-transformers
```

### 2. Create `.env`

```env
HF_API_KEY=hf_your_token_here
```

Get a token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).  
The token needs **Inference** permission (free tier works).

### 3. Add support documents

```bash
mkdir support_docs
# Drop .txt or .md files describing past tickets and resolutions
```

Example file `support_docs/hardware.txt`:
```
Issue: Laptop screen black on boot, fans running.
Resolution: Perform a hard reset — hold power 10 s. Reseat RAM if persists.
Urgency: high
```

---

## Usage

### Ingest documents

```bash
python rag_ticket_system.py ingest
```

Chunks and embeds all `.txt`/`.md` files from `./support_docs/` into ChromaDB.  
Re-run whenever you add or update documents.

### Query a ticket

```bash
python rag_ticket_system.py query "My laptop screen stays black after I press power."
```

Output:
```json
{
  "possible_cause": "Display or boot failure caused by RAM or firmware issue",
  "recommended_steps": "1. Hold power button 10 seconds (hard reset)\n2. Reseat RAM\n3. Boot in safe mode",
  "urgency": "high",
  "sentiment": "neutral"
}
```

Typos are corrected automatically:
```bash
python rag_ticket_system.py query "myaltpop wont turn on"
# pre-processed → "my laptop wont turn on"
```

Out-of-domain queries return the fallback without calling the LLM:
```bash
python rag_ticket_system.py query "How do I bake a cake?"
# → "No past tickets found. Escalate to a human agent."
```

### Run the evaluation suite

```bash
python rag_ticket_system.py eval
```

Runs 4 labeled test cases (3 in-domain + 1 out-of-domain) and prints pass/fail.

---

## Project Structure

```
.
├── rag_ticket_system.py   # single self-contained script
├── support_docs/          # drop .txt/.md knowledge base files here
├── chroma_db/             # auto-created persistent vector store
├── .env                   # HF_API_KEY=...
└── README.md
```

---

## How to Extend

### Add more documents
Drop `.txt` or `.md` files into `./support_docs/` and re-run `ingest`.

### Change the LLM model
Edit `LLM_MODEL` in the Configuration section:
```python
LLM_MODEL = "mistralai/Mistral-7B-Instruct-v0.3:hf-inference"
```
Any OpenAI-compatible model on the HF Router works.

### Tune the confidence threshold
Lower `DISTANCE_THRESHOLD` (e.g. `0.6`) to be stricter; raise it to allow looser matches:
```python
DISTANCE_THRESHOLD = 0.6   # only use very close matches
```

### Add more typo corrections
Append regex patterns to `TYPO_MAP` in the Query Pre-processor section:
```python
TYPO_MAP[r"\byour_typo\b"] = "corrected_word"
```

### Change chunk size
Smaller chunks = more precise retrieval; larger chunks = more context per result:
```python
CHUNK_SIZE   = 500
CHUNK_OVERLAP = 100
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `LLM_MODEL` | `deepseek-ai/DeepSeek-V4-Pro:novita` | HF Router model ID |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Local sentence-transformers model |
| `TEMPERATURE` | `0.1` | Lower = more deterministic output |
| `MAX_TOKENS` | `1024` | Max tokens in LLM response |
| `CHUNK_SIZE` | `300` | Characters per document chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between consecutive chunks |
| `DISTANCE_THRESHOLD` | `0.8` | Max cosine distance before fallback |
| `CONFIDENCE_THRESHOLD` | `0.2` | Min confidence score before fallback |

---

## License

MIT
