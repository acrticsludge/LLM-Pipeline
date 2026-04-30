import argparse
from pipeline import extract_ticket
from evaluation import run_evaluation
from logger import logger

def main():
    parser = argparse.ArgumentParser(description="LLM Extraction Pipeline (Hugging Face)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Run on a custom ticket
    run_parser = subparsers.add_parser("extract", help="Extract from a ticket string")
    run_parser.add_argument("--text", required=True, help="The support ticket text")

    # Run evaluation
    eval_parser = subparsers.add_parser("eval", help="Run evaluation suite")

    args = parser.parse_args()

    if args.command == "extract":
        ticket = extract_ticket(args.text)
        print("\n--- Structured Ticket ---")
        print(ticket.model_dump_json(indent=2))
    
    elif args.command == "eval":
        run_evaluation()

if __name__ == "__main__":
    main()