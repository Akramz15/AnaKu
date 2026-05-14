from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import Optional
from api.deps import get_current_user, require_role
from services.cloudinary_service import upload_media, delete_media
from supabase import create_client
from core.config import settings
import uuid

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

@router.post("/upload", dependencies=[Depends(require_role("caregiver"))])
async def upload_gallery(
    file: UploadFile = File(...),
    child_id: str = Form(...),
    caption: str = Form(""),
    location: str = Form(""),
    activity_date: str = Form(""),
    current_user = Depends(get_current_user)
):
    """[Caregiver] Upload foto ke Cloudinary, lalu simpan metadata ke DB"""
    # Validasi tipe file hanya foto
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipe file tidak didukung. Hanya menerima JPG, PNG, WEBP.")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, "Ukuran file melebihi 50 MB")

    unique_name = f"{child_id}_{uuid.uuid4().hex[:8]}"

    # Upload ke Cloudinary
    cloud_result = upload_media(content, unique_name)

    # Simpan metadata ke database
    gallery_data = {
        "child_id": child_id,
        "uploader_id": current_user["id"],
        "cloudinary_url": cloud_result["url"],
        "public_id": cloud_result["public_id"],
        "media_type": "photo",
        "caption": caption,
        "activity_date": activity_date or None,
    }
    res = sb.table("galleries").insert(gallery_data).execute()
    return {"status": "success", "data": res.data[0]}

@router.get("/")
async def list_gallery(
    child_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Ambil galeri. Parent hanya lihat anaknya sendiri."""
    query = sb.table("galleries").select("*, children(full_name), caregiver:users!uploader_id(full_name)")
    if child_id:
        query = query.eq("child_id", child_id)
    elif current_user["role"] == "parent":
        kids = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        raw_kids = kids.data if isinstance(kids.data, list) else []
        ids = [k.get("id") for k in raw_kids if isinstance(k, dict) and k.get("id")]
        if not ids:
            return {"status": "success", "data": []}
        query = query.in_("child_id", ids)
        
    res = query.order("created_at", desc=True).execute()
    return {"status": "success", "data": res.data}

@router.delete("/{gallery_id}", dependencies=[Depends(require_role("caregiver"))])
async def delete_gallery(gallery_id: str):
    """[Caregiver] Hapus foto dari DB dan Cloudinary"""
    item = sb.table("galleries").select("*").eq("id", gallery_id).single().execute()
    if not item.data:
        raise HTTPException(404, "Media tidak ditemukan")
        
    # Hapus file fisik dari Cloudinary
    data_dict = item.data
    if isinstance(data_dict, dict):
        pub_id = str(data_dict.get("public_id") or "")
        if pub_id:
            delete_media(pub_id)
    
    # Hapus record dari Database
    sb.table("galleries").delete().eq("id", gallery_id).execute()
    return {"status": "success", "message": "Foto berhasil dihapus"}
