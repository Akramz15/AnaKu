from fastapi import APIRouter, Depends, BackgroundTasks
from typing import Optional
from datetime import date as date_type
from api.deps import get_current_user, require_role
from schemas.daily_log import DailyLogCreate
from services.ai_service import analyze_sentiment, generate_daily_summary
from supabase import create_client
from core.config import settings

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.post("/", dependencies=[Depends(require_role("caregiver"))])
async def create_daily_log(
    payload: DailyLogCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """
    Caregiver input laporan harian.
    Setelah disimpan, Sentiment Analysis dijalankan di background.
    """
    data = payload.model_dump()
    data["caregiver_id"] = current_user["id"]
    if data.get("log_date"):
        data["log_date"] = data["log_date"].isoformat()
    else:
        data["log_date"] = date_type.today().isoformat()

    # Simpan log ke database
    res = sb.table("daily_logs").upsert(data, on_conflict="child_id,log_date").execute()
    
    raw_data = res.data if isinstance(res.data, list) and len(res.data) > 0 else []
    first_item = raw_data[0] if raw_data and isinstance(raw_data[0], dict) else {}
    log_id = str(first_item.get("id") or "")

    # Jalankan sentiment analysis di background (non-blocking)
    text_to_analyze = f"{payload.special_notes or ''} {payload.mood or ''}"
    if text_to_analyze.strip() and log_id:
        background_tasks.add_task(analyze_sentiment, log_id, text_to_analyze)
    
    # Jalankan juga pembuatan AI Daily Summary
    background_tasks.add_task(generate_daily_summary, data["child_id"], data["log_date"])

    return {"status": "success", "data": first_item}

@router.get("/")
async def get_daily_logs(
    child_id: Optional[str] = None,
    log_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Ambil daily logs. Filter: child_id, log_date."""
    query = sb.table("daily_logs").select("*, children(full_name), caregiver:users!caregiver_id(full_name)")
    if child_id:
        query = query.eq("child_id", child_id)
    if log_date:
        query = query.eq("log_date", log_date)
    if current_user["role"] == "parent":
        # Parent hanya lihat anaknya sendiri
        kids = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        raw_kids = kids.data if isinstance(kids.data, list) else []
        child_ids = [k.get("id") for k in raw_kids if isinstance(k, dict) and k.get("id")]
        if not child_ids:
            return {"status": "success", "data": []}
        query = query.in_("child_id", child_ids)
    res = query.order("log_date", desc=True).execute()
    return {"status": "success", "data": res.data}

@router.get("/sentiment-trend")
async def get_sentiment_trend(child_id: str, current_user = Depends(get_current_user)):
    """
    Ambil data sentimen 7 hari terakhir untuk grafik tren emosi.
    Return: list [{log_date, sentiment_label, sentiment_score}]
    """
    from datetime import date, timedelta
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
    res = sb.table("daily_logs") \
        .select("log_date, sentiment_label, sentiment_score, mood") \
        .eq("child_id", child_id) \
        .gte("log_date", seven_days_ago) \
        .order("log_date").execute()
    return {"status": "success", "data": res.data}
