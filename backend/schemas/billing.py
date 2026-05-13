from pydantic import BaseModel
from typing import Optional
from datetime import date

class BillingCreate(BaseModel):
    child_id: str
    period_month: int       # 1-12
    period_year: int
    base_fee: float         # Tarif dasar per bulan
    due_date: Optional[date] = None
    notes: Optional[str] = None

class BillingStatusUpdate(BaseModel):
    status: str             # 'paid' | 'unpaid' | 'overdue'
