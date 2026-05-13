from pydantic import BaseModel
from typing import Optional

class MessageCreate(BaseModel):
    receiver_id: str
    message: str
    room_id: Optional[str] = None
