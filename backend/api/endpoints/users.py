from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from core.config import settings
from api.deps import get_current_user, require_role
from services.cloudinary_service import upload_media
import uuid

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ── Schemas ───────────────────────────────────────────────────────────────────
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone:     Optional[str] = None


# ── GET /api/v1/users/me ──────────────────────────────────────────────────────
@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Ambil profil user yang sedang login."""
    return {"status": "success", "data": current_user}


# ── PUT /api/v1/users/me ──────────────────────────────────────────────────────
@router.put("/me")
async def update_me(payload: UserUpdate, current_user=Depends(get_current_user)):
    """Update profil user (nama, telepon)."""
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada data yang dikirim")

    res = sb.table("users").update(updates).eq("id", current_user["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Gagal memperbarui profil")
    return {"status": "success", "data": res.data[0]}


# ── POST /api/v1/users/me/avatar ──────────────────────────────────────────────
@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    """Upload foto profil user ke Cloudinary lalu simpan URL ke tabel users."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")

    contents = await file.read()
    public_id = f"anaku/avatars/user_{current_user['id']}_{uuid.uuid4().hex[:8]}"

    try:
        result = upload_media(contents, public_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload gagal: {str(e)}")

    res = sb.table("users").update({"avatar_url": result["url"]}).eq("id", current_user["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Gagal menyimpan URL avatar")

    return {"status": "success", "data": {"avatar_url": result["url"]}}


# ── GET /api/v1/users/ ────────────────────────────────────────────────────────
@router.get("/")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    """Ambil daftar user. Admin bisa filter berdasarkan role & status."""
    query = sb.table("users").select("id, full_name, role, phone, avatar_url, status").order("full_name")
    if role:
        query = query.eq("role", role)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return {"status": "success", "data": res.data}


# ── GET /api/v1/users/{user_id} ───────────────────────────────────────────────
@router.get("/{user_id}")
async def get_user(user_id: str, current_user=Depends(get_current_user)):
    """Ambil profil user berdasarkan ID."""
    res = sb.table("users").select("id, full_name, role, phone, avatar_url").eq("id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return {"status": "success", "data": res.data}
