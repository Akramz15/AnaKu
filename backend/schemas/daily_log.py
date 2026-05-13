from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class DailyLogCreate(BaseModel):
    child_id: str
    log_date: Optional[date] = None
    meal_morning: Optional[str] = None   # habis|setengah|tidak_makan
    meal_lunch: Optional[str] = None
    meal_snack: Optional[str] = None
    sleep_duration_min: Optional[int] = None
    sleep_quality: Optional[str] = None  # nyenyak|gelisah|tidak_tidur
    mood: Optional[str] = None           # ceria|biasa|rewel|menangis
    activities: Optional[List[str]] = []
    special_notes: Optional[str] = None
    toilet_count: Optional[int] = 0
    health_notes: Optional[str] = None
