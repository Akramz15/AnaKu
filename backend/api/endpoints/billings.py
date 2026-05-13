from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user, require_role
from schemas.billing import BillingCreate, BillingStatusUpdate
from supabase import create_client
from core.config import settings
from datetime import datetime, timezone

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.post("/", dependencies=[Depends(require_role("admin"))])
async def create_billing(payload: BillingCreate):
    """
    [Admin] Generate tagihan bulanan untuk satu anak.
    Otomatis hitung hari hadir dari tabel attendances.
    """
    # Cek apakah sudah ada tagihan bulan ini
    existing = sb.table("billings").select("id") \
        .eq("child_id", payload.child_id) \
        .eq("period_month", payload.period_month) \
        .eq("period_year", payload.period_year).execute()
    if existing.data:
        raise HTTPException(409, "Tagihan bulan ini sudah ada untuk anak tersebut")

    # Hitung hari kehadiran dari tabel attendances
    m = payload.period_month
    y = payload.period_year
    next_m = 1 if m == 12 else m + 1
    next_y = y + 1 if m == 12 else y
    date_start = f"{y}-{m:02d}-01"
    date_end   = f"{next_y}-{next_m:02d}-01"

    att_res = sb.table("attendances").select("id") \
        .eq("child_id", payload.child_id) \
        .eq("status", "present") \
        .gte("date", date_start) \
        .lt("date", date_end).execute()
    attendance_days = len(att_res.data)

    # Total = base_fee (billing sederhana, bisa dikembangkan per-hari)
    total = payload.base_fee

    data = {
        "child_id": payload.child_id,
        "period_month": payload.period_month,
        "period_year": payload.period_year,
        "base_fee": payload.base_fee,
        "attendance_days": attendance_days,
        "total_amount": total,
        "due_date": payload.due_date.isoformat() if payload.due_date else None,
        "notes": payload.notes,
        "status": "unpaid",
    }
    res = sb.table("billings").insert(data).execute()
    return {"status": "success", "data": res.data[0]}

@router.get("/")
async def list_billings(
    child_id: str = None,
    current_user = Depends(get_current_user)
):
    """
    Admin: semua tagihan (filter opsional child_id).
    Parent: tagihan anak miliknya.
    """
    query = sb.table("billings").select("*, children(full_name, users!parent_id(full_name))")
    if current_user["role"] == "parent":
        kids = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        ids = [k["id"] for k in kids.data]
        if not ids:
            return {"status": "success", "data": []}
        query = query.in_("child_id", ids)
    elif child_id:
        query = query.eq("child_id", child_id)

    res = query.order("period_year", desc=True).order("period_month", desc=True).execute()
    return {"status": "success", "data": res.data}

@router.patch("/{billing_id}", dependencies=[Depends(require_role("admin"))])
async def update_billing_status(billing_id: str, payload: BillingStatusUpdate):
    """[Admin] Update status tagihan (tandai lunas/terlambat)"""
    data = {"status": payload.status}
    if payload.status == "paid":
        data["paid_at"] = datetime.now(timezone.utc).isoformat()
    res = sb.table("billings").update(data).eq("id", billing_id).execute()
    return {"status": "success", "data": res.data[0]}

@router.delete("/{billing_id}", dependencies=[Depends(require_role("admin"))])
async def delete_billing(billing_id: str):
    """[Admin] Hapus tagihan"""
    sb.table("billings").delete().eq("id", billing_id).execute()
    return {"status": "success", "message": "Tagihan dihapus"}
