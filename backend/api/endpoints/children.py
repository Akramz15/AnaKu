from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user, require_role
from supabase import create_client
from core.config import settings

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

from datetime import datetime

@router.get("/")
async def list_children(current_user=Depends(get_current_user)):
    """List anak (Admin/Caregiver lihat semua, Parent lihat miliknya)"""
    query = sb.table("children").select("*, parent:users(full_name, phone)")
    
    if current_user["role"] == "parent":
        query = query.eq("parent_id", current_user["id"])
    
    result = query.execute()
    children_data = result.data

    # Tambahkan status presensi hari ini
    today = datetime.now().date().isoformat()
    att_res = sb.table("attendances").select("*").eq("date", today).execute()
    att_map = {att["child_id"]: att for att in att_res.data}

    for child in children_data:
        child["today_attendance"] = att_map.get(child["id"])

    return {"status": "success", "data": children_data}

@router.post("/", dependencies=[Depends(require_role("admin"))])
async def create_child(payload: dict):
    """Admin: Tambah data anak baru"""
    res = sb.table("children").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Gagal menambah data anak")
    return {"status": "success", "data": res.data[0]}

@router.put("/{child_id}")
async def update_child(child_id: str, payload: dict, current_user=Depends(get_current_user)):
    """Admin & Parent: Update data anak"""
    if current_user["role"] == "parent":
        # Verifikasi kepemilikan anak
        child_res = sb.table("children").select("parent_id").eq("id", child_id).single().execute()
        if not child_res.data or child_res.data["parent_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Akses ditolak")
    elif current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak")

    res = sb.table("children").update(payload).eq("id", child_id).execute()
    return {"status": "success", "data": res.data}

from fastapi import UploadFile, File
from services.cloudinary_service import upload_media
import uuid

@router.post("/{child_id}/photo")
async def upload_child_photo(
    child_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    if current_user["role"] == "parent":
        child_res = sb.table("children").select("parent_id").eq("id", child_id).single().execute()
        if not child_res.data or child_res.data["parent_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Akses ditolak")
    elif current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak")

    content = await file.read()
    unique_name = f"child_{child_id}_{uuid.uuid4().hex[:8]}"
    cloud_result = upload_media(content, unique_name)
    sb.table("children").update({"photo_url": cloud_result["url"]}).eq("id", child_id).execute()
    return {"status": "success", "photo_url": cloud_result["url"]}

@router.delete("/{child_id}", dependencies=[Depends(require_role("admin"))])
async def delete_child(child_id: str):
    """Admin: Hapus data anak"""
    sb.table("children").delete().eq("id", child_id).execute()
    return {"status": "success", "message": "Data anak dihapus"}
