from fastapi import APIRouter, Depends, BackgroundTasks
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
    log_id = res.data[0]["id"]

    # Jalankan sentiment analysis di background (non-blocking)
    text_to_analyze = f"{payload.special_notes or ''} {payload.mood or ''}"
    if text_to_analyze.strip():
        background_tasks.add_task(analyze_sentiment, log_id, text_to_analyze)
    
    # Jalankan juga pembuatan AI Daily Summary
    background_tasks.add_task(generate_daily_summary, data["child_id"], data["log_date"])

    return {"status": "success", "data": res.data[0]}

@router.get("/")
async def get_daily_logs(
    child_id: str = None,
    log_date: str = None,
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
        child_ids = [k["id"] for k in kids.data]
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
