from pydantic import BaseModel
from typing import Optional

class ChatbotRequest(BaseModel):
    child_id: Optional[str] = None
    message: str
    log_date: Optional[str] = None
