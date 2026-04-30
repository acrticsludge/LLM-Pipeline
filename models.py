from pydantic import BaseModel, Field
from typing import Literal

class SupportTicket(BaseModel):
    customer_name: str = Field(description="Full name of the customer")
    issue_summary: str = Field(description="One-sentence summary of the problem")
    urgency: Literal["low", "medium", "high", "critical"] = Field(
        description="Urgency extracted from tone and keywords"
    )
    sentiment: Literal["positive", "neutral", "negative"] = Field(
        description="Overall emotional tone"
    )