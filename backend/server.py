from __future__ import annotations

import asyncio
import json
import logging
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
# Constants
# ---------------------------------------------------------------------------

CHUNK_SIZE = 300
CHUNK_OVERLAP = 50
TOP_K = 3
CONFIDENCE_THRESHOLD = 0.6
MAX_RETRIES = 3
COLLECTION_NAME = "support_docs"
STATUS_FILE = Path("chroma_db/.status.json")

# ---------------------------------------------------------------------------
# Synonym maps for enum normalization
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

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class Resolution(BaseModel):
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
        return list(v)

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


def is_likely_ticket(text: str) -> bool:
    """Quick pre-check to filter obvious non-tickets before LLM call."""
    stripped = text.strip().lower()
    if len(stripped) < 10:
        return False
    casual_keywords = {"hello", "hey", "what's up", "wazzup", "yo", "hi", "bye", "thanks"}
    if any(kw in stripped for kw in casual_keywords):
        return False
    return True


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
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"```$", "", raw)
        raw = raw.strip()
    if raw.count('"') % 2 != 0:
        raw += '"'
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
        json.dumps(
            {"total_chunks": total, "last_ingestion": datetime.now(timezone.utc).isoformat()}
        )
    )


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


# ---------------------------------------------------------------------------
# POST /query  (SSE)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a support copilot. Your task is to determine whether the user's message is a genuine support ticket or a casual/off-topic message.

If the message is a casual greeting, vague statement, or off-topic question, you must respond with ONLY the following JSON:

{"type": "non_ticket", "message": "I'm a support copilot. Please describe a technical issue you're facing, and I'll do my best to help."}

If the message is a genuine support ticket (a clear description of a computer, hardware, software, or account problem), you must extract the following fields and output them inside a JSON object with type "ticket":

- possible_cause: a brief description of what might be wrong
- recommended_steps: a list of steps to resolve the issue (if no steps, use ["Please contact support."])
- urgency: "low", "medium", "high", or "critical" based on keywords like "ASAP", "down", "lost data"
- sentiment: "positive", "neutral", or "negative"
- disclaimer: a string noting that the answer is AI-generated and should be verified, or null if not applicable

IMPORTANT:
- Output ONLY the JSON object. Never include explanatory text, greetings, or other messages.
- Do not invent fields (like ticket_id) that were not requested.
- Use "Unknown" for any field you cannot determine.
- recommended_steps MUST be a JSON array of strings, not a single string.
- urgency and sentiment MUST be exactly one of the allowed values.
"""

USER_TEMPLATE = """\
User message: {ticket_text}

First, decide if this is a real support ticket or a casual/off-topic message. Then output the appropriate JSON object (either non_ticket or ticket) as described."""


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

    count = collection.count()
    sources: list[dict] = []

    if count > 0:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(TOP_K, count),
            include=["documents", "distances", "metadatas"],
        )
        docs: list[str] = results["documents"][0] if results["documents"] else []
        distances: list[float] = results["distances"][0] if results["distances"] else []
        metadatas: list[dict] = results["metadatas"][0] if results["metadatas"] else []

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
    else:
        docs = []

    top_confidence = sources[0]["score"] if sources else 0.0

    async def event_stream() -> AsyncGenerator[str, None]:
        # Pre-check: skip obvious non-tickets
        if not is_likely_ticket(req.question):
            yield _sse({
                "type": "final",
                "is_ticket": False,
                "message": "I'm a support copilot. Please describe a technical issue you're facing, and I'll do my best to help.",
                "sources": [],
                "corrected_query": corrected_query,
            })
            return

        if req.strict and top_confidence < CONFIDENCE_THRESHOLD:
            yield _sse(
                {
                    "type": "final",
                    "is_ticket": True,
                    "resolution": FALLBACK_RESOLUTION,
                    "sources": sources,
                    "corrected_query": corrected_query,
                }
            )
            return

        context = "\n---\n".join(docs) if docs else "No documents available."
        prompt = f"{SYSTEM_PROMPT}\n\n{USER_TEMPLATE.format(ticket_text=corrected_question)}\n\nContext:\n{context}"

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
        except Exception as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return

        try:
            repaired = repair_json(full_text)
            parsed = json.loads(repaired)

            # Check if this is a non-ticket response
            if parsed.get("type") == "non_ticket":
                yield _sse({
                    "type": "final",
                    "is_ticket": False,
                    "message": parsed.get("message", "I'm a support copilot. Please describe a technical issue you're facing, and I'll do my best to help."),
                    "sources": sources,
                    "corrected_query": corrected_query,
                })
                return

            # Otherwise, process as a ticket
            cleaned = replace_nulls(parsed)
            if disclaimer:
                cleaned["disclaimer"] = disclaimer
            resolution = Resolution(**cleaned).model_dump()
        except Exception as exc:
            logger.error("Validation error: %s — raw: %.200s", exc, full_text)
            resolution = {**FALLBACK_RESOLUTION, "disclaimer": f"Parse error: {exc}"}

        yield _sse(
            {
                "type": "final",
                "is_ticket": True,
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
