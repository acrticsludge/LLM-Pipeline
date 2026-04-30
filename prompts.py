SYSTEM_PROMPT = (
    "You are a precise data extraction assistant. "
    "You must output ONLY a valid JSON object. "
    "Do not include explanations, markdown fences, or extra text."
)

USER_TEMPLATE = """Extract the following fields from the support ticket:

- customer_name
- issue_summary
- urgency (one of: low, medium, high, critical)
- sentiment (one of: positive, neutral, negative)

Return exactly a JSON object with those four keys.

Support ticket:
{ticket_text}"""