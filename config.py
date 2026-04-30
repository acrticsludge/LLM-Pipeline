import os
from dotenv import load_dotenv

load_dotenv()

# --- Hugging Face Router API (OpenAI-compatible) ---
HF_TOKEN = os.getenv("HF_API_KEY")  # same env var, just renamed for clarity
if not HF_TOKEN:
    raise EnvironmentError("HF_API_KEY not found in .env file")

# The single base URL for ALL models via the router
BASE_URL = "https://router.huggingface.co/v1"

# Model ID (provider:novita routes to Novita AI's deployment)
MODEL_NAME = "deepseek-ai/DeepSeek-V4-Pro:novita"

# Pipeline settings
TEMPERATURE = 0.1          # low for structured extraction; can be 0.0 for deterministic
MAX_TOKENS = 512           # renamed from MAX_NEW_TOKENS
STREAMING = True
RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1.0