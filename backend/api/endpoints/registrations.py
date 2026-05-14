from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from supabase import create_client
from core.config import settings
from postgrest.types import CountMethod
from api.deps import get_current_user, require_role, get_auth_user
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ── Schema ────────────────────────────────────────────────────────────────────
class RejectPayload(BaseModel):
    reason: Optional[str] = "Tidak memenuhi syarat"

class CompleteProfilePayload(BaseModel):
    full_name: str
    phone: str


# ── Email helper ──────────────────────────────────────────────────────────────
def _send_email(to_email: str, subject: str, html_body: str):
    """Kirim email via Supabase SMTP (atau skip jika tidak dikonfigurasi)."""
    try:
        smtp_host_raw = getattr(settings, "SMTP_HOST", None)
        smtp_port_raw = getattr(settings, "SMTP_PORT", 587)
        smtp_user_raw = getattr(settings, "SMTP_USER", None)
        smtp_pass_raw = getattr(settings, "SMTP_PASS", None)
        smtp_from_raw = getattr(settings, "SMTP_FROM", smtp_user_raw)

        if not all([smtp_host_raw, smtp_user_raw, smtp_pass_raw]):
            print(f"[EMAIL SKIP] SMTP not configured. To: {to_email} | Subject: {subject}")
            return False
        
        # Type guarantee for pyright
        smtp_host: str = str(smtp_host_raw)
        smtp_port: int = int(smtp_port_raw or 587)
        smtp_user: str = str(smtp_user_raw)
        smtp_pass: str = str(smtp_pass_raw)
        smtp_from: str = str(smtp_from_raw)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = smtp_from
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port) as srv:
            srv.starttls()
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(smtp_from, [to_email], msg.as_string())
        print(f"[EMAIL OK] Sent to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


def _approve_email(full_name: str, email: str) -> bool:
    subject = "🎉 Akun AnaKuu Anda Telah Diaktifkan!"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:2rem;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="color:#1A3A6B;">Selamat, {full_name}! 🎉</h2>
      <p style="color:#475569;">Admin daycare telah menyetujui akun AnaKuu Anda.</p>
      <p style="color:#475569;">Sekarang Anda sudah bisa login dan memantau aktivitas si kecil.</p>
      <a href="{settings.FRONTEND_URL}/login"
         style="display:inline-block;margin-top:1rem;padding:0.75rem 2rem;background:#84D6FE;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
        Masuk ke AnaKuu
      </a>
      <p style="margin-top:1.5rem;font-size:0.82rem;color:#94A3B8;">
        Terima kasih telah mempercayakan si kecil kepada kami 💙
      </p>
    </div>
    """
    return _send_email(email, subject, html)


def _reject_email(full_name: str, email: str, reason: str) -> bool:
    subject = "Informasi Pendaftaran AnaKuu"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:2rem;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="color:#DC2626;">Mohon Maaf, {full_name}</h2>
      <p style="color:#475569;">Pendaftaran akun AnaKuu Anda tidak dapat diproses saat ini.</p>
      <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:1rem;border-radius:6px;margin:1rem 0;">
        <strong style="color:#DC2626;">Alasan:</strong>
        <p style="margin:0.25rem 0 0;color:#475569;">{reason or 'Tidak memenuhi syarat'}</p>
      </div>
      <p style="color:#475569;">Jika ada pertanyaan, silakan hubungi admin daycare secara langsung.</p>
      <p style="margin-top:1.5rem;font-size:0.82rem;color:#94A3B8;">Tim AnaKuu</p>
    </div>
    """
    return _send_email(email, subject, html)


def _pending_email(full_name: str, email: str) -> bool:
    subject = "📩 Pendaftaran AnaKuu Berhasil Diterima"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:2rem;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="color:#1A3A6B;">Halo {full_name}! 👋</h2>
      <p style="color:#475569;">Terima kasih telah mendaftarkan akun Anda di AnaKuu.</p>
      <p style="color:#475569;">Data Anda sudah kami terima dan saat ini sedang dalam antrean <b>Verifikasi Admin</b>.</p>
      <p style="color:#475569;">Proses ini biasanya memerlukan waktu maksimal 1x24 jam. Kami akan mengirimkan email notifikasi lanjutan setelah akun Anda diaktifkan.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;" />
      <p style="font-size:0.82rem;color:#94A3B8;">
        Silakan simpan email ini sebagai konfirmasi pendaftaran Anda.
      </p>
    </div>
    """
    return _send_email(email, subject, html)


# ── POST /api/v1/registrations/complete-profile ───────────────────────────────
@router.post("/complete-profile")
async def complete_profile(payload: CompleteProfilePayload, auth_user=Depends(get_auth_user)):
    """User baru (via Google) melengkapi profil dan masuk antrean pending."""
    # Cek data user saat ini
    existing = sb.table("users").select("id, status").eq("id", auth_user["id"]).execute()
    current_status = "pending"
    
    if existing.data and len(existing.data) > 0:
        user_row = existing.data[0]
        current_status = "pending"
        if isinstance(user_row, dict):
            current_status = str(user_row.get("status", "pending"))
        
        # Jika user sudah 'active' (disetujui admin sebelumnya), JANGAN ubah ke pending lagi!
        new_status = "active" if current_status == "active" else "pending"
        
        sb.table("users").update({
            "full_name": payload.full_name,
            "phone": payload.phone,
            "status": new_status
        }).eq("id", auth_user["id"]).execute()
        
        final_status = new_status
    else:
        # Kasus langka user tidak ada di tabel, default ke pending
        sb.table("users").insert({
            "id": auth_user["id"],
            "full_name": payload.full_name,
            "phone": payload.phone,
            "role": "parent",
            "status": "pending"
        }).execute()
        final_status = "pending"
    
    # Kirim email notifikasi PENDING HANYA jika status barunya pending
    # (Jika active, berarti admin sudah mengirim email approve sebelumnya)
    if final_status == "pending":
        email_target = auth_user.get("email")
        if email_target:
            _pending_email(payload.full_name, email_target)
        
    return {
        "status": "success", 
        "message": "Profil berhasil diperbarui",
        "is_active": (final_status == "active")
    }

# ── GET /api/v1/registrations/ ────────────────────────────────────────────────
@router.get("/")
async def list_registrations(
    status: Optional[str] = None,
    current_user=Depends(require_role("admin"))
):
    """[Admin] List pendaftaran. Filter by status: pending | active | rejected"""
    query = sb.table("users").select("id,full_name,phone,status,rejection_reason,approved_at,created_at").eq("role", "parent")
    if status:
        query = query.eq("status", status)
    res = query.order("created_at", desc=True).execute()

    # Fetch emails from Supabase Auth Admin API since 'email' is stored there, not in public.users
    try:
        auth_users = sb.auth.admin.list_users()
        email_map = {u.id: u.email for u in auth_users}
    except:
        email_map = {}

    # Map emails back to result data
    data = []
    if isinstance(res.data, list):
        for row in res.data:
            if isinstance(row, dict):
                new_row = dict(row)
                new_row["email"] = email_map.get(str(new_row.get("id")), "—")
                data.append(new_row)

    return {"status": "success", "data": data}


# ── GET /api/v1/registrations/count ───────────────────────────────────────────
@router.get("/count")
async def count_pending(current_user=Depends(require_role("admin"))):
    """[Admin] Jumlah pendaftaran pending (untuk badge sidebar)."""
    res = sb.table("users").select("id", count=CountMethod.exact).eq("role", "parent").eq("status", "pending").execute()
    return {"status": "success", "count": res.count or 0}


# ── POST /api/v1/registrations/{user_id}/approve ─────────────────────────────
@router.post("/{user_id}/approve")
async def approve_registration(user_id: str, current_user=Depends(require_role("admin"))):
    """[Admin] Setujui pendaftaran → update status active + kirim email."""
    # Ambil data user
    user_res = sb.table("users").select("full_name,status").eq("id", user_id).single().execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    # Ambil email dari auth admin api
    user_email = ""
    try:
        u_auth = sb.auth.admin.get_user_by_id(user_id)
        user_email = (u_auth.user.email or "") if u_auth and u_auth.user else ""
    except: pass

    user = user_res.data
    if not isinstance(user, dict):
        raise HTTPException(status_code=500, detail="Format data tidak valid")
        
    if user.get("status") == "active":
        raise HTTPException(status_code=400, detail="Akun sudah aktif")

    # Update status
    sb.table("users").update({
        "status": "active",
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": current_user["id"],
        "rejection_reason": None,
    }).eq("id", user_id).execute()

    # Kirim email notifikasi
    full_name = str(user.get("full_name") or "Pengguna")
    _approve_email(full_name, user_email)

    return {"status": "success", "message": f"Akun {full_name} berhasil diaktifkan"}


# ── POST /api/v1/registrations/{user_id}/reject ───────────────────────────────
@router.post("/{user_id}/reject")
async def reject_registration(
    user_id: str,
    payload: RejectPayload,
    current_user=Depends(require_role("admin"))
):
    """[Admin] Tolak pendaftaran → update status rejected + kirim email."""
    user_res = sb.table("users").select("full_name,status").eq("id", user_id).single().execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    # Ambil email dari auth admin api
    user_email = ""
    try:
        u_auth = sb.auth.admin.get_user_by_id(user_id)
        user_email = (u_auth.user.email or "") if u_auth and u_auth.user else ""
    except: pass

    user = user_res.data
    if not isinstance(user, dict):
        raise HTTPException(status_code=500, detail="Format data tidak valid")

    # Update status
    sb.table("users").update({
        "status": "rejected",
        "rejection_reason": payload.reason,
    }).eq("id", user_id).execute()

    # Kirim email notifikasi
    full_name = str(user.get("full_name") or "Pengguna")
    _reject_email(full_name, user_email, payload.reason or "")

    return {"status": "success", "message": f"Pendaftaran {full_name} telah ditolak"}
