from models import SupportTicket
from pipeline import extract_ticket
from logger import logger

# Test dataset: (ticket_text, expected fields)
TEST_CASES = [
    {
        "text": "Hi, I'm Mike. My emails aren't syncing since the update. No rush, just a heads-up.",
        "expected": {
            "customer_name": "Mike",
            "urgency": "low",
            "sentiment": "neutral"
        }
    },
    {
        "text": "URGENT - Jane here! Payment gateway returning 500 errors, customers can't buy. Fix NOW.",
        "expected": {
            "customer_name": "Jane",
            "urgency": "critical",
            "sentiment": "negative"
        }
    },
    {
        "text": "Hello, this is Ravi. The dashboard loads slowly but I can work. Just letting you know.",
        "expected": {
            "customer_name": "Ravi",
            "urgency": "medium",
            "sentiment": "neutral"
        }
    },
]

def run_evaluation():
    """Evaluate extraction on the test set and print a report."""
    logger.info("Starting evaluation...")
    total = len(TEST_CASES)
    exact_matches = 0
    for i, case in enumerate(TEST_CASES, 1):
        logger.info(f"Evaluating case {i}/{total}")
        try:
            result = extract_ticket(case["text"])
            expected = case["expected"]
            # Compare key fields (issue_summary is harder, so we skip for exact match)
            if (result.customer_name == expected["customer_name"] and
                result.urgency == expected["urgency"] and
                result.sentiment == expected["sentiment"]):
                exact_matches += 1
                logger.info(f"✅ Case {i} passed")
            else:
                logger.warning(f"❌ Case {i} mismatch")
                logger.warning(f"   Got:      name={result.customer_name}, urgency={result.urgency}, sentiment={result.sentiment}")
                logger.warning(f"   Expected: name={expected['customer_name']}, urgency={expected['urgency']}, sentiment={expected['sentiment']}")
        except Exception as e:
            logger.error(f"💥 Case {i} failed with error: {e}")
    
    accuracy = (exact_matches / total) * 100
    logger.info(f"Evaluation complete. Accuracy: {accuracy:.1f}% ({exact_matches}/{total})")
