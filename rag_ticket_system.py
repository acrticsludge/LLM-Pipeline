#!/usr/bin/env python3
"""
RAG Ticket Intelligence System (v2)
-------------------------------------
Ingests support docs, retrieves similar past tickets via ChromaDB,
and generates structured resolutions using DeepSeek-V4-Pro.

Commands:
    python rag_ticket_system.py ingest          -- chunk & embed docs
    python rag_ticket_system.py query "<text>"  -- resolve a ticket
    python rag_ticket_system.py eval            -- run eval suite
"""

import os
import json
import time
import argparse
import logging
import re
from difflib import get_close_matches
from typing import List, Tuple

# ---------- Dependencies ----------
# pip install openai pydantic python-dotenv chromadb sentence-transformers

try:
    from dotenv import load_dotenv
    from openai import OpenAI
    from pydantic import BaseModel, Field, ValidationError, field_validator
    import chromadb
    from sentence_transformers import SentenceTransformer
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install openai pydantic python-dotenv chromadb sentence-transformers")
    raise SystemExit(1)

load_dotenv()

# ======================================================================
# Configuration
# ======================================================================
HF_API_KEY = os.getenv("HF_API_KEY")
if not HF_API_KEY:
    print("ERROR: HF_API_KEY not set in .env")
    raise SystemExit(1)

BASE_URL          = "https://router.huggingface.co/v1"
LLM_MODEL         = "deepseek-ai/DeepSeek-V4-Pro:novita"
EMBEDDING_MODEL   = "all-MiniLM-L6-v2"   # local, 384-dim, no API needed
CHROMA_DB_PATH    = "./chroma_db"
DOCUMENTS_FOLDER  = "./support_docs"
CHUNK_SIZE        = 300                   # characters per chunk
CHUNK_OVERLAP     = 50
TEMPERATURE       = 0.1
MAX_TOKENS        = 1024                  # raised to reduce truncation
STREAMING         = True
DISTANCE_THRESHOLD = 0.8                 # cosine distance; above = out-of-domain
CONFIDENCE_THRESHOLD = 0.2              # 1 - distance; below = fallback

# ======================================================================
# Logging
# ======================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("rag_ticket")

# ======================================================================
# Pydantic schema
# ======================================================================
class Resolution(BaseModel):
    possible_cause:    str
    recommended_steps: str
    urgency:           str = Field(..., pattern="low|medium|high|critical")
    sentiment:         str = Field(..., pattern="positive|neutral|negative")

    # Edge case 2: LLM sometimes returns a JSON array for recommended_steps
    @field_validator("recommended_steps", mode="before")
    @classmethod
    def coerce_list_to_string(cls, v):
        if isinstance(v, list):
            return "\n".join(str(item) for item in v)
        return v


# Predefined fallback returned when retrieval confidence is too low
FALLBACK_RESOLUTION = Resolution(
    possible_cause="Unknown – no matching historical tickets.",
    recommended_steps=(
        "No past tickets found for this query. Escalate to a human agent."
    ),
    urgency="medium",
    sentiment="neutral",
)


_SENTIMENT_MAP = {
    "frustrated": "negative",
    "angry":      "negative",
    "upset":      "negative",
    "unhappy":    "negative",
    "sad":        "negative",
    "happy":      "positive",
    "satisfied":  "positive",
    "pleased":    "positive",
    "calm":       "neutral",
    "confused":   "neutral",
}
_VALID_SENTIMENTS = {"positive", "neutral", "negative"}

_URGENCY_MAP = {
    "urgent":    "high",
    "emergency": "critical",
    "severe":    "high",
    "minor":     "low",
    "moderate":  "medium",
    "normal":    "medium",
}
_VALID_URGENCIES = {"low", "medium", "high", "critical"}


def sanitize_data(data: dict) -> dict:
    """Replace None/null and normalize invalid enum values before Pydantic."""
    defaults = {
        "possible_cause":    "Unknown",
        "recommended_steps": "Please contact support.",
        "urgency":           "medium",
        "sentiment":         "neutral",
    }
    for key, default in defaults.items():
        if data.get(key) is None:
            data[key] = default

    # Normalize sentiment: map synonyms, fall back to "neutral"
    raw_sentiment = str(data.get("sentiment", "")).lower().strip()
    if raw_sentiment not in _VALID_SENTIMENTS:
        normalized = _SENTIMENT_MAP.get(raw_sentiment, "neutral")
        logger.info(f"Normalized sentiment '{raw_sentiment}' -> '{normalized}'")
        data["sentiment"] = normalized

    # Normalize urgency: map synonyms, fall back to "medium"
    raw_urgency = str(data.get("urgency", "")).lower().strip()
    if raw_urgency not in _VALID_URGENCIES:
        normalized = _URGENCY_MAP.get(raw_urgency, "medium")
        logger.info(f"Normalized urgency '{raw_urgency}' -> '{normalized}'")
        data["urgency"] = normalized

    return data


# ======================================================================
# Edge case 5: JSON repair for truncated LLM output
# ======================================================================
def repair_json(partial: str) -> dict:
    """Try to close a truncated JSON string; raise ValueError if impossible."""
    try:
        return json.loads(partial)
    except json.JSONDecodeError:
        stripped = partial.rstrip()
        for suffix in ['"}', '}', '"]}', '"}]}']:
            try:
                return json.loads(stripped + suffix)
            except json.JSONDecodeError:
                continue
        raise ValueError(f"Irreparable JSON (tail): ...{partial[-200:]}")


# ======================================================================
# Edge case 6: Query pre-processor — typo correction & normalization
# ======================================================================
TYPO_MAP = {
    r"\bmyaltpop\b":       "my laptop",
    r"\blaptrop\b":        "laptop",
    r"\blabtop\b":         "laptop",
    r"\bscreeen\b":        "screen",
    r"\bbluetooh\b":       "bluetooth",
    r"\bwi-fi\b":          "wifi",
    r"\bpasswrod\b":       "password",
    r"\bpasword\b":        "password",
    r"\bkeybord\b":        "keyboard",
    r"\bmosue\b":          "mouse",
    r"\bprnitr\b":         "printer",
    r"\binstlal\b":        "install",
    r"\bupdaet\b":         "update",
    r"\bcahce\b":          "cache",
    r"\bdeleet\b":         "delete",
    r"\bfreze\b":          "freeze",
    r"\bfrozne\b":         "frozen",
    r"\bcrashign\b":       "crashing",
    r"\bcrashng\b":        "crashing",
    r"\bconect\b":         "connect",
    r"\bconection\b":      "connection",
    r"\beroor\b":          "error",
    r"\berro\b":           "error",
    r"\bsingin\b":         "sign in",
    r"\bsignin\b":         "sign in",
    r"\binternet connexion\b": "internet connection",
}


def preprocess_query(text: str) -> str:
    """Lowercase, apply typo fixes, collapse whitespace."""
    result = text.lower()
    for pattern, replacement in TYPO_MAP.items():
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    result = re.sub(r"\s+", " ", result).strip()
    if result != text.lower():
        logger.info(f"Query corrected: '{text}' -> '{result}'")
    return result


# ======================================================================
# Prompts
# ======================================================================
RAG_SYSTEM_PROMPT = (
    "You are a support expert. Use the provided past similar tickets and resolutions "
    "to answer the new ticket. Output ONLY a valid JSON object with fields: "
    "possible_cause, recommended_steps, urgency, sentiment. "
    "No extra text, no markdown fences."
)

RAG_USER_TEMPLATE = """Past similar tickets and solutions:
{context}

New ticket:
{ticket_text}

Return a JSON resolution with possible_cause, recommended_steps, urgency, sentiment."""


# ======================================================================
# Embedding & Vector Store
# ======================================================================
embedder      = SentenceTransformer(EMBEDDING_MODEL)
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
collection    = chroma_client.get_or_create_collection(
    name="support_tickets",
    embedding_function=None,   # we embed manually
)


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    chunks, start = [], 0
    while start < len(text):
        chunks.append(text[start : start + size])
        start += size - overlap
    return chunks


def ingest_documents():
    """Chunk, embed, and store all .txt/.md files from DOCUMENTS_FOLDER."""
    if not os.path.exists(DOCUMENTS_FOLDER):
        os.makedirs(DOCUMENTS_FOLDER)
        print(f"Created '{DOCUMENTS_FOLDER}/'. Add .txt/.md files and re-run ingest.")
        return

    docs = []
    for fname in sorted(os.listdir(DOCUMENTS_FOLDER)):
        if fname.endswith((".txt", ".md")):
            path = os.path.join(DOCUMENTS_FOLDER, fname)
            with open(path, "r", encoding="utf-8") as f:
                docs.append(f.read())
            logger.info(f"  Loaded: {fname}")

    if not docs:
        # Edge case 8: clear warning + actionable hint
        print(
            "WARNING: No .txt/.md files found in './support_docs/'.\n"
            "Add documents and run:  python rag_ticket_system.py ingest"
        )
        return

    # Rebuild collection from scratch
    chroma_client.delete_collection("support_tickets")
    global collection
    collection = chroma_client.create_collection("support_tickets")

    all_chunks, all_ids = [], []
    for doc_idx, doc_text in enumerate(docs):
        for chunk_idx, chunk in enumerate(chunk_text(doc_text)):
            all_chunks.append(chunk)
            all_ids.append(f"doc{doc_idx}_chunk{chunk_idx}")

    logger.info(f"Embedding {len(all_chunks)} chunks...")
    embeddings = embedder.encode(all_chunks).tolist()
    collection.add(ids=all_ids, documents=all_chunks, embeddings=embeddings)
    logger.info(f"Ingestion complete — {len(all_chunks)} chunks stored.")


# ======================================================================
# Retrieval
# ======================================================================
def retrieve_context(query: str, top_k: int = 3) -> Tuple[str, float]:
    """Return (context_string, confidence).

    confidence == 0.0 means either the collection is empty (edge case 3)
    or the best match is too distant (edge case 4 / 7).
    """
    # Edge case 3: empty collection
    count = collection.count()
    if count == 0:
        logger.warning(
            "Vector DB is empty. Run 'python rag_ticket_system.py ingest' first."
        )
        return "", 0.0

    n = min(top_k, count)
    query_vec = embedder.encode([query]).tolist()
    results = collection.query(
        query_embeddings=query_vec,
        n_results=n,
        include=["documents", "distances"],
    )

    documents = results["documents"][0] if results["documents"] else []
    distances = results["distances"][0] if results["distances"] else []

    if not distances:
        return "", 0.0

    best_dist = min(distances)

    # Edge cases 4 & 7: low-confidence or out-of-domain query
    if best_dist > DISTANCE_THRESHOLD:
        logger.info(
            f"Best distance {best_dist:.3f} > threshold {DISTANCE_THRESHOLD} "
            "(out-of-domain or unrelated query)."
        )
        return "", 0.0

    confidence = round(1.0 - best_dist, 3)
    context = "\n\n".join(documents)
    return context, confidence


# ======================================================================
# LLM call  (edge case 9: exponential backoff + 429 detection)
# ======================================================================
llm_client = OpenAI(api_key=HF_API_KEY, base_url=BASE_URL)


def call_llm(ticket_text: str, context: str) -> str:
    messages = [
        {"role": "system", "content": RAG_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": RAG_USER_TEMPLATE.format(
                context=context, ticket_text=ticket_text
            ),
        },
    ]

    for attempt in range(3):
        try:
            logger.info(f"LLM call attempt {attempt + 1}/3")
            stream = llm_client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                stream=STREAMING,
                response_format={"type": "json_object"},
            )
            full = ""
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    print(delta, end="", flush=True)
                    full += delta
            print()
            return full

        except Exception as exc:
            err = str(exc)
            rate_limited = "429" in err or "rate" in err.lower()
            backoff = (2 ** attempt) * (2 if rate_limited else 1)
            logger.warning(f"Attempt {attempt + 1} failed: {exc}. Retry in {backoff}s.")
            time.sleep(backoff)

    raise RuntimeError("LLM call failed after 3 attempts.")


# ======================================================================
# Main pipeline
# ======================================================================
def answer_ticket(ticket_text: str) -> Resolution:
    # Edge case 6: fix typos before embedding
    processed = preprocess_query(ticket_text)

    context, confidence = retrieve_context(processed)

    # Edge cases 3, 4, 7: empty DB or out-of-domain
    if confidence == 0.0:
        return FALLBACK_RESOLUTION

    if confidence < CONFIDENCE_THRESHOLD:
        logger.info(f"Confidence {confidence:.3f} below threshold — returning fallback.")
        return FALLBACK_RESOLUTION

    logger.info(f"Confidence: {confidence:.3f} | Context: {len(context)} chars")
    raw = call_llm(processed, context)

    # Edge case 5: truncated JSON
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("JSON parse failed — attempting repair.")
        try:
            data = repair_json(raw)
        except ValueError:
            logger.error("JSON repair failed — returning fallback.")
            return FALLBACK_RESOLUTION

    # Edge case 1: null fields
    data = sanitize_data(data)

    try:
        return Resolution(**data)   # edge case 2 handled by field_validator
    except ValidationError as exc:
        logger.error(f"Pydantic validation failed: {exc}")
        return FALLBACK_RESOLUTION


# ======================================================================
# Evaluation
# ======================================================================
EVAL_CASES = [
    {
        "label":    "Black screen on boot",
        "ticket":   "My laptop screen stays black after pressing power, but I hear fans.",
        "expected": "hard reset",
    },
    {
        "label":    "WiFi drops",
        "ticket":   "WiFi keeps dropping every 5 minutes on my phone.",
        "expected": "forget",
    },
    {
        "label":    "Password reset",
        "ticket":   "I forgot my account password and can't log in.",
        "expected": "reset",
    },
    {
        "label":    "Out-of-domain (cake recipe)",
        "ticket":   "How do I bake a cake with chocolate frosting?",
        "expected": "escalate",   # fallback should mention escalation
    },
]


def eval_rag():
    logger.info("Running evaluation suite...")
    passed = 0
    for case in EVAL_CASES:
        try:
            res    = answer_ticket(case["ticket"])
            haystack = (res.recommended_steps + " " + res.possible_cause).lower()
            ok     = case["expected"] in haystack
            status = "PASS" if ok else "FAIL"
            if ok:
                passed += 1
            logger.info(f"  {status} [{case['label']}]")
            if not ok:
                logger.warning(
                    f"       Expected '{case['expected']}' in output.\n"
                    f"       Got: {res.recommended_steps[:120]}"
                )
        except Exception as exc:
            logger.error(f"  ERROR [{case['label']}]: {exc}")

    logger.info(f"Result: {passed}/{len(EVAL_CASES)} passed.")


# ======================================================================
# CLI
# ======================================================================
def main():
    parser = argparse.ArgumentParser(description="RAG Ticket Intelligence System")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("ingest", help="Chunk & embed docs from ./support_docs/")
    qp = sub.add_parser("query",  help="Resolve a support ticket")
    qp.add_argument("text", help="Ticket text (wrap in quotes)")
    sub.add_parser("eval",   help="Run evaluation suite")

    args = parser.parse_args()

    if args.command == "ingest":
        ingest_documents()
    elif args.command == "query":
        res = answer_ticket(args.text)
        print("\n--- Resolution ---")
        print(res.model_dump_json(indent=2))
    elif args.command == "eval":
        eval_rag()


if __name__ == "__main__":
    main()
