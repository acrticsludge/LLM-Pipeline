# LLM Pipeline — Support Ticket Extractor

Structured data extraction from customer support tickets using LLMs via the Hugging Face Router API.

Given raw ticket text, the pipeline returns a validated JSON object with customer name, issue summary, urgency, and sentiment.

## How It Works

```
ticket text → prompt → DeepSeek-V4-Pro (HF Router) → JSON → Pydantic validation → SupportTicket
```

- Calls `deepseek-ai/DeepSeek-V4-Pro:novita` through the HF Router (OpenAI-compatible endpoint)
- Streams the response token-by-token
- Retries up to 3 times on failure
- Sanitizes null fields before Pydantic validation

## Output Schema

```json
{
  "customer_name": "Jane",
  "issue_summary": "Payment gateway returning 500 errors",
  "urgency": "critical",
  "sentiment": "negative"
}
```

| Field | Type | Values |
|---|---|---|
| `customer_name` | `str` | extracted name, defaults to `"Unknown"` |
| `issue_summary` | `str` | one-sentence problem summary |
| `urgency` | `enum` | `low` · `medium` · `high` · `critical` |
| `sentiment` | `enum` | `positive` · `neutral` · `negative` |

## Setup

**1. Install dependencies**

```bash
pip install openai pydantic python-dotenv
```

**2. Create `.env`**

```env
HF_API_KEY=hf_your_token_here
```

Get a token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).

## Usage

### Extract a ticket

```bash
python main.py extract --text "URGENT - Jane here! Payment gateway returning 500 errors. Fix NOW."
```

Output:

```
--- Structured Ticket ---
{
  "customer_name": "Jane",
  "issue_summary": "Payment gateway is returning 500 errors preventing customers from completing purchases.",
  "urgency": "critical",
  "sentiment": "negative"
}
```

### Run evaluation suite

```bash
python main.py eval
```

Runs 3 labeled test cases and prints accuracy (matches on name, urgency, sentiment).

## Project Structure

```
.
├── main.py          # CLI entrypoint (extract / eval subcommands)
├── pipeline.py      # Core extraction logic: prompt → model → validate
├── models.py        # Pydantic SupportTicket schema
├── prompts.py       # System prompt and user template
├── config.py        # API config, model name, retry settings
├── evaluation.py    # Test dataset and evaluation loop
└── logger.py        # Logging setup
```

## Configuration

Edit `config.py` to change model or pipeline behavior:

| Variable | Default | Description |
|---|---|---|
| `MODEL_NAME` | `deepseek-ai/DeepSeek-V4-Pro:novita` | HF Router model ID |
| `TEMPERATURE` | `0.1` | Lower = more deterministic |
| `MAX_TOKENS` | `512` | Max response length |
| `RETRY_ATTEMPTS` | `3` | Retries on API failure |
| `RETRY_DELAY_SECONDS` | `1.0` | Delay between retries |
