from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from api.deps import get_current_user, require_role
from supabase import create_client
from core.config import settings

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.get("/")
async def list_attendances(child_id: Optional[str] = None, current_user=Depends(get_current_user)):
    """List riwayat kehadiran"""
    query = sb.table("attendances").select("*, child:children(full_name)")
    if child_id:
        query = query.eq("child_id", child_id)
    
    if current_user["role"] == "parent":
        child_res = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        child_data = child_res.data if isinstance(child_res.data, list) else []
        child_ids = [c.get("id") for c in child_data if isinstance(c, dict) and "id" in c]
        if child_ids:
            query = query.in_("child_id", child_ids)
        else:
            # Jika tidak ada anak, return kosong
            return {"status": "success", "data": []}

    result = query.order("date", desc=True).execute()
    return {"status": "success", "data": result.data}

@router.post("/", dependencies=[Depends(require_role("admin"))])
async def toggle_attendance(payload: dict):
    """Admin: Ubah status presensi hari ini (Check In / Check Out)"""
    child_id = payload.get("child_id")
    status = payload.get("status")  # 'Checked In' or 'Checked Out' or 'Active'
    
    from datetime import datetime, timezone
    # Convert to local timezone date for "today" string to match logical grouping, but keep check_in_at UTC
    import pytz
    local_tz = pytz.timezone('Asia/Jakarta')
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(local_tz)
    
    today = now_local.date().isoformat()
    now = now_utc.isoformat()
    
    # Cari presensi hari ini
    att = sb.table("attendances").select("*").eq("date", today).eq("child_id", child_id).execute()
    att_list = att.data if isinstance(att.data, list) else []
    att_record = att_list[0] if att_list and isinstance(att_list[0], dict) else None
    
    if status == "Checked In":
        if not att_record:
            res = sb.table("attendances").insert({
                "child_id": child_id,
                "date": today,
                "check_in_at": now
            }).execute()
            r_list = res.data if isinstance(res.data, list) else []
            return {"status": "success", "data": r_list[0] if r_list else None}
    elif status == "Checked Out":
        if att_record:
            res = sb.table("attendances").update({
                "check_out_at": now
            }).eq("id", att_record.get("id")).execute()
        else:
            res = sb.table("attendances").insert({
                "child_id": child_id,
                "date": today,
                "check_out_at": now
            }).execute()
        
        # -- AUTOMATION: Create billing for the month if not exists --
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        existing_bill = sb.table("billings").select("id")\
            .eq("child_id", child_id)\
            .eq("period_month", current_month)\
            .eq("period_year", current_year).execute()
        
        eb_data = existing_bill.data if isinstance(existing_bill.data, list) else []
        
        if not eb_data:
            # Create default monthly bill automatically
            sb.table("billings").insert({
                "child_id": child_id,
                "period_month": current_month,
                "period_year": current_year,
                "base_fee": 500000, # Default fee example
                "total_amount": 500000,
                "status": "unpaid",
                "attendance_days": 1
            }).execute()
        
        r_list = res.data if isinstance(res.data, list) else []
        return {"status": "success", "data": r_list[0] if r_list else None}
    else:
        # Reset (Active)
        if att_record:
            sb.table("attendances").delete().eq("id", att_record.get("id")).execute()
            return {"status": "success", "message": "Attendance reset"}

    return {"status": "success"}
