import json
import time
import re
from pydantic import ValidationError
from openai import OpenAI

from config import HF_TOKEN, BASE_URL, MODEL_NAME, TEMPERATURE, MAX_TOKENS, STREAMING, RETRY_ATTEMPTS, RETRY_DELAY_SECONDS
from prompts import SYSTEM_PROMPT, USER_TEMPLATE
from models import SupportTicket
from logger import logger

# Initialize the OpenAI client pointed at Hugging Face's router
client = OpenAI(
    api_key=HF_TOKEN,
    base_url=BASE_URL,
)

def sanitize_data(data: dict) -> dict:
    """Replace null/None with sensible defaults for required string fields."""
    defaults = {
        "customer_name": "Unknown",
        "issue_summary": "Not provided",
        "urgency": "low",
        "sentiment": "neutral",
    }
    for key, default_val in defaults.items():
        if data.get(key) is None:
            data[key] = default_val
    return data

def call_model_with_retry(messages: list[dict]) -> str:
    """Call the Hugging Face Router API (OpenAI-compatible) with streaming and retries."""
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            logger.info(f"Attempt {attempt}: calling {MODEL_NAME}")
            stream = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                stream=STREAMING,
                response_format={"type": "json_object"},
            )
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    print(content, end="", flush=True)
                    full_response += content
            print("\n")
            if full_response.strip():
                return full_response
            else:
                logger.warning("Received empty response")
        except Exception as e:
            logger.error(f"API call failed: {e}")
            if attempt == RETRY_ATTEMPTS:
                raise RuntimeError(f"Failed after {RETRY_ATTEMPTS} attempts") from e
            time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError("Unexpected: loop ended without returning")

def extract_ticket(ticket_text: str) -> SupportTicket:
    """Full extraction pipeline: builds prompt, calls model, sanitizes, validates."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_TEMPLATE.format(ticket_text=ticket_text)}
    ]
    
    raw_output = call_model_with_retry(messages)
    
    # Parse JSON (should always succeed thanks to response_format)
    try:
        data = json.loads(raw_output)
    except json.JSONDecodeError:
        # Fallback: extract JSON via regex (extremely rare with json_object mode)
        match = re.search(r'\{.*\}', raw_output, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError(f"Could not parse JSON from model output: {raw_output[:200]}")
    
    # Sanitize nulls before Pydantic validation
    data = sanitize_data(data)
    
    # Validate and return
    try:
        ticket = SupportTicket(**data)
        return ticket
    except ValidationError as e:
        logger.error(f"Validation failed even after sanitization. Data: {data}")
        raise