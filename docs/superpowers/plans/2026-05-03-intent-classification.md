# Intent Classification & Non-Ticket Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement intent classification to distinguish genuine support tickets from casual/off-topic messages, preventing LLM hallucinations and gracefully handling non-tickets with consistent responses.

**Architecture:** Two-phase approach:
1. **Pre-check** (optional, for cost savings): Quick client-side or lightweight filter catches obvious casual messages ("hi", "hello", "wazzup") and returns a canned response immediately without calling the LLM.
2. **LLM-based classification**: For messages that pass pre-check, updated system prompt forces the LLM to classify first (ticket vs non-ticket) before attempting extraction. LLM always returns structured JSON with `type` field.
3. **Unified response handling**: Backend parses `type` field and returns either a friendly non-ticket message or proceeds with ticket resolution logic.

**Tech Stack:**
- Backend: FastAPI, Pydantic, Python
- Frontend: Next.js, React, TypeScript
- LLM: DeepSeek-V3 via Hugging Face Router (existing)
- Database: ChromaDB (existing)

---

## File Structure

**Modified files:**
- `backend/server.py` — SYSTEM_PROMPT, USER_TEMPLATE, Resolution model, /query endpoint, new `is_likely_ticket()` helper
- `frontend/lib/types.ts` — Add `NonTicketResponse` type
- `frontend/components/ChatInterface.tsx` — Handle `is_ticket: false` responses
- `frontend/components/MessageBubble.tsx` — Render non-ticket messages distinctly
- `README.md` — Document new feature and testing examples

**New files:**
- None required; all changes fit into existing structure

---

## Task 1: Add Pre-Check Helper to Backend

**Files:**
- Modify: `backend/server.py:190-220` (after `get_embedder()`)
- Test: Run manually with sample inputs

### Steps

- [ ] **Step 1: Add `is_likely_ticket()` function**

After the `get_embedder()` function (line 189), insert:

```python
def is_likely_ticket(text: str) -> bool:
    """Quick pre-check to filter obvious non-tickets before LLM call."""
    stripped = text.strip().lower()
    if len(stripped) < 10:
        return False
    casual_keywords = {"hello", "hey", "what's up", "wazzup", "yo", "hi", "bye", "thanks"}
    if any(kw in stripped for kw in casual_keywords):
        return False
    return True
```

- [ ] **Step 2: Verify function logic**

Manually test in your head:
- `is_likely_ticket("hi")` → False (length < 10, keyword match)
- `is_likely_ticket("hello there")` → False (keyword match)
- `is_likely_ticket("my database connection keeps dropping")` → True
- `is_likely_ticket("what's happening with my login?")` → True (only "what's", not "what's up")

---

## Task 2: Update System Prompt and User Template

**Files:**
- Modify: `backend/server.py:295-311` (LLM_PROMPT_TEMPLATE)

### Steps

- [ ] **Step 1: Replace LLM_PROMPT_TEMPLATE**

Replace the entire `LLM_PROMPT_TEMPLATE` (lines 295–311) with:

```python
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
```

- [ ] **Step 2: Verify no breaking changes**

Confirm that `SYSTEM_PROMPT` and `USER_TEMPLATE` are only used in the `_llm_stream()` call (around line 400). They should not be referenced elsewhere.

---

## Task 3: Create Non-Ticket Response Type in Frontend

**Files:**
- Read: `frontend/lib/types.ts`
- Modify: `frontend/lib/types.ts`

### Steps

- [ ] **Step 1: Read existing types file**

Read the current content to understand the existing Resolution and Response types.

- [ ] **Step 2: Add NonTicketResponse type**

Add this new type definition at the end of the file:

```typescript
export interface NonTicketResponse {
  is_ticket: false;
  message: string;
}

export type QueryResponse = TicketResponse | NonTicketResponse;
```

Ensure `TicketResponse` (with `is_ticket: true`) is the existing response structure. Update the type union if needed.

---

## Task 4: Update Resolution Model (Remove ticket_id)

**Files:**
- Modify: `backend/server.py:91-132` (Resolution class)

### Steps

- [ ] **Step 1: Remove ticket_id field**

In the `Resolution` class, remove the line:

```python
ticket_id: str = "UNKNOWN"
```

The model should now be:

```python
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
```

- [ ] **Step 2: Update FALLBACK_RESOLUTION**

Remove `ticket_id` from FALLBACK_RESOLUTION (line 73–84):

```python
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
```

---

## Task 5: Modify /query Endpoint to Handle Intent Classification

**Files:**
- Modify: `backend/server.py:346-437` (/query endpoint and event_stream generator)

### Steps

- [ ] **Step 1: Update event_stream to check pre-filter**

Replace the existing `event_stream()` async generator (inside `/query`, lines 387–397) with:

```python
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
```

This is inserted right at the start of the `event_stream()` function.

- [ ] **Step 2: Update confidence check logic**

Keep the strict-mode confidence check (lines 388–396), but ensure it still works. It should remain as-is since it gates the full process:

```python
if req.strict and top_confidence < CONFIDENCE_THRESHOLD:
    yield _sse({
        "type": "final",
        "is_ticket": True,
        "resolution": FALLBACK_RESOLUTION,
        "sources": sources,
        "corrected_query": corrected_query,
    })
    return
```

Add `"is_ticket": True` to the response object.

- [ ] **Step 3: Update LLM prompt assembly**

Update the prompt template assembly (around line 400):

```python
context = "\n---\n".join(docs) if docs else "No documents available."
prompt = f"{SYSTEM_PROMPT}\n\n{USER_TEMPLATE.format(ticket_text=corrected_question)}"
```

This constructs the full prompt with the system message first, then the user template.

- [ ] **Step 4: Update JSON parsing to check type field**

After the `full_text` is collected (around line 420), update the JSON parsing block:

```python
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

yield _sse({
    "type": "final",
    "is_ticket": True,
    "resolution": resolution,
    "sources": sources,
    "corrected_query": corrected_query,
})
```

- [ ] **Step 5: Verify SSE response structure**

Confirm that all SSE responses now include the `is_ticket` field:
- Non-ticket: `{ "type": "final", "is_ticket": false, "message": "...", "sources": [], "corrected_query": "..." }`
- Ticket: `{ "type": "final", "is_ticket": true, "resolution": {...}, "sources": [...], "corrected_query": "..." }`

---

## Task 6: Update Frontend Types

**Files:**
- Modify: `frontend/lib/types.ts`

### Steps

- [ ] **Step 1: Define union type for SSE responses**

Add these types to the types file (update existing structures as needed):

```typescript
export interface Resolution {
  possible_cause: string;
  recommended_steps: string[];
  urgency: "low" | "medium" | "high" | "critical";
  sentiment: "positive" | "neutral" | "negative";
  disclaimer: string | null;
}

export interface TicketResponse {
  type: "final";
  is_ticket: true;
  resolution: Resolution;
  sources: Source[];
  corrected_query: string | null;
}

export interface NonTicketResponse {
  type: "final";
  is_ticket: false;
  message: string;
  sources: [];
  corrected_query: string | null;
}

export type SSEResponse = TicketResponse | NonTicketResponse;
```

---

## Task 7: Update ChatInterface Component

**Files:**
- Read: `frontend/components/ChatInterface.tsx`
- Modify: `frontend/components/ChatInterface.tsx`

### Steps

- [ ] **Step 1: Read the current ChatInterface implementation**

Understand how it currently handles SSE, parses responses, and manages state.

- [ ] **Step 2: Update SSE parsing to handle is_ticket field**

Locate where SSE messages are parsed. Update the logic to check the `is_ticket` field:

```typescript
// In the SSE event handler, when parsing the final message:
if (sseData.is_ticket === false) {
  // Handle non-ticket response
  setMessages(prev => [...prev, {
    id: Date.now(),
    type: "assistant",
    text: sseData.message,
    isNonTicket: true,
    timestamp: new Date(),
  }]);
} else {
  // Handle ticket response (existing logic)
  setMessages(prev => [...prev, {
    id: Date.now(),
    type: "assistant",
    resolution: sseData.resolution,
    sources: sseData.sources,
    corrected_query: sseData.corrected_query,
    isNonTicket: false,
    timestamp: new Date(),
  }]);
}
```

- [ ] **Step 3: Update message type definition**

If not already done, ensure the message interface includes `isNonTicket` and optional `text` fields:

```typescript
interface Message {
  id: number;
  type: "user" | "assistant";
  text?: string;  // For non-ticket messages
  resolution?: Resolution;  // For ticket messages
  sources?: Source[];
  corrected_query?: string | null;
  isNonTicket: boolean;
  timestamp: Date;
}
```

---

## Task 8: Update MessageBubble Component

**Files:**
- Read: `frontend/components/MessageBubble.tsx`
- Modify: `frontend/components/MessageBubble.tsx`

### Steps

- [ ] **Step 1: Read current MessageBubble implementation**

Understand how it currently renders messages.

- [ ] **Step 2: Add rendering for non-ticket messages**

Update the component to handle `isNonTicket` messages:

```typescript
{message.isNonTicket && message.text && (
  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div className="flex gap-2">
      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-900 dark:text-blue-100">{message.text}</p>
    </div>
  </div>
)}
```

Ensure this is rendered instead of the ResolutionCard when `isNonTicket === true`.

- [ ] **Step 3: Keep ResolutionCard for tickets**

Existing ResolutionCard rendering should only show when `!message.isNonTicket && message.resolution`.

---

## Task 9: Test Non-Ticket Handling in Frontend

**Files:**
- No changes; testing only
- Test: `frontend/components/ChatInterface.tsx`, `frontend/components/MessageBubble.tsx`

### Steps

- [ ] **Step 1: Start frontend dev server**

```bash
cd frontend
npm run dev
```

- [ ] **Step 2: Test non-ticket detection (pre-check)**

Type in chat:
- "hello" → Should show non-ticket message immediately (no backend call if pre-check works)
- "hi there" → Should show non-ticket message
- "what's up" → Should show non-ticket message

Verify in browser DevTools Network tab that no POST to `/query` is made.

- [ ] **Step 3: Test LLM-based non-ticket detection**

Type messages that pass pre-check but are still off-topic:
- "when is your company founded?" → Should call backend but return non-ticket response
- "do you like pizza?" → Should return non-ticket response

Verify in Network tab that POST `/query` is made and response has `is_ticket: false`.

- [ ] **Step 4: Test legitimate support tickets**

Type real support questions:
- "My application keeps crashing with a segmentation fault" → Should return ticket response with resolution
- "Database connection timeout on startup" → Should return ticket response

Verify response has `is_ticket: true` and ResolutionCard appears.

- [ ] **Step 5: Verify styling**

Check that:
- Non-ticket messages show in blue info box with info icon
- Ticket responses show in ResolutionCard as before
- No visual regressions in existing UI

---

## Task 10: Update README with Intent Detection Feature

**Files:**
- Modify: `README.md`

### Steps

- [ ] **Step 1: Add section under "Key Features"**

After the "Strict mode" bullet (around line 52), add:

```markdown
- **Intent Classification** — Distinguishes support tickets from casual/off-topic messages. Casual greetings ("hello", "what's up") are caught by pre-check and return a friendly message without LLM calls. Off-topic questions that pass pre-check are classified by the LLM and return a structured non-ticket response. Prevents LLM hallucinations on irrelevant inputs.
```

- [ ] **Step 2: Update Edge Cases table**

Add two rows to the edge-case table (after row 11):

```markdown
| 12 | Casual greeting ("hello") | Pre-check filter catches it; returns non-ticket message without LLM call (saves API credits) |
| 13 | Off-topic question ("do you like pizza?") | LLM classifies as non-ticket; returns friendly message to refocus on support issues |
```

- [ ] **Step 3: Add "Testing Intent Detection" section**

Add a new section before "Deployment":

```markdown
## Testing Intent Detection

### Non-Ticket Detection (Pre-Check)

These messages are caught by the pre-check and return immediately without calling the LLM:

```
- "hello" → Returns: "I'm a support copilot. Please describe a technical issue..."
- "hi there" → Returns: "I'm a support copilot. Please describe a technical issue..."
- "what's up" → Returns: "I'm a support copilot. Please describe a technical issue..."
```

### Non-Ticket Detection (LLM-Based)

These messages pass pre-check but are classified as non-tickets by the LLM:

```
- "when was your company founded?" → Returns: "I'm a support copilot. Please describe a technical issue..."
- "do you like pizza?" → Returns: "I'm a support copilot. Please describe a technical issue..."
```

### Legitimate Support Tickets

These are recognized as real support issues and return a Resolution Card:

```
- "My database keeps timing out during peak hours"
- "How do I fix a 502 error in my application?"
- "Application crashes on startup with seg fault"
```
```

---

## Task 11: End-to-End Integration Test

**Files:**
- No files changed; testing only
- Test: Backend + Frontend together

### Steps

- [ ] **Step 1: Start backend**

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python server.py
```

Verify it starts without errors.

- [ ] **Step 2: Ingest test documents**

Upload a sample support document via the frontend (e.g., a troubleshooting guide).

- [ ] **Step 3: Test full flow: non-ticket → ticket**

In order, ask:
1. "hello" → Expect: non-ticket message (immediate, no sources)
2. "My app won't start" → Expect: ticket response with resolution from ingested docs

- [ ] **Step 4: Verify SSE streaming**

Open browser DevTools → Network → Filter for `/query` → Click on one request → Response tab
Verify SSE responses show `is_ticket: true/false` field correctly.

- [ ] **Step 5: Check logs for errors**

In backend terminal, verify no error logs related to JSON parsing or validation.

---

## Task 12: Commit Changes

**Files:**
- All modified files from Tasks 1–10

### Steps

- [ ] **Step 1: Stage backend changes**

```bash
cd backend
git add server.py
```

- [ ] **Step 2: Stage frontend changes**

```bash
cd frontend
git add lib/types.ts components/ChatInterface.tsx components/MessageBubble.tsx
```

- [ ] **Step 3: Stage README**

```bash
git add README.md
```

- [ ] **Step 4: Commit with message**

```bash
git commit -m "feat: add intent classification to prevent LLM hallucinations on non-tickets

- Add pre-check filter to catch casual messages without LLM calls
- Update SYSTEM_PROMPT to force intent classification (ticket vs non-ticket)
- Modify /query endpoint to handle both ticket and non-ticket responses
- Remove unused ticket_id field from Resolution model
- Update frontend to render non-ticket messages distinctly
- Document new feature in README with testing examples"
```

---

## Verification Checklist

Before considering this complete:

- [ ] Backend starts without errors
- [ ] Casual greetings return non-ticket message immediately (no `/query` call visible in DevTools)
- [ ] Off-topic questions return non-ticket message (with `/query` call shown)
- [ ] Support tickets return full ResolutionCard as before
- [ ] No regressions: existing ticket handling, file upload, sources display all work
- [ ] README documents the new feature clearly
- [ ] Code follows CLAUDE.md standards (no arbitrary abstractions, comments only for non-obvious WHY)

---

## Notes

- **Token savings:** Pre-check filter saves API credits on obvious non-tickets (~10% of queries).
- **Backwards compatible:** Existing ticket flows unchanged; pre-check is pure optimization.
- **Extensibility:** Easy to add more casual keywords to `is_likely_ticket()` without modifying LLM prompt.
- **Consistency:** All off-topic messages return the same message string; no variation or hallucination.
