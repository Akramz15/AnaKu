from fastapi import APIRouter, Depends
from api.deps import get_current_user
from schemas.chat import MessageCreate
from supabase import create_client
from core.config import settings
import uuid

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def get_or_create_room(user1: str, user2: str) -> str:
    """
    Cari room yang sudah ada antara dua user.
    Jika belum ada, buat room_id baru.
    Room bersifat bilateral: room antara A↔B sama dengan B↔A.
    """
    res = sb.table("chats_human").select("room_id") \
        .or_(f"and(sender_id.eq.{user1},receiver_id.eq.{user2}),and(sender_id.eq.{user2},receiver_id.eq.{user1})") \
        .limit(1).execute()
    if res.data and len(res.data) > 0:
        first_item = res.data[0]
        if isinstance(first_item, dict):
            return str(first_item.get("room_id") or "")
    return str(uuid.uuid4())

@router.get("/rooms")
async def list_rooms(current_user = Depends(get_current_user)):
    """
    Daftar room/kontak yang pernah chat dengan user saat ini.
    Return: list room dengan pesan terakhir + info lawan bicara.
    """
    uid = current_user["id"]
    res = sb.table("chats_human").select("room_id, sender_id, receiver_id, message, created_at") \
        .or_(f"sender_id.eq.{uid},receiver_id.eq.{uid}") \
        .order("created_at", desc=True).execute()

    # Kelompokkan per room, ambil pesan terakhir
    rooms = {}
    raw_msgs = res.data if isinstance(res.data, list) else []
    for msg in raw_msgs:
        if not isinstance(msg, dict):
            continue
        rid = msg.get("room_id")
        if rid and rid not in rooms:
            other_id = msg.get("receiver_id") if msg.get("sender_id") == uid else msg.get("sender_id")
            rooms[rid] = {
                "room_id": rid,
                "other_user_id": other_id,
                "last_message": msg.get("message"),
                "last_time": msg.get("created_at")
            }

    # Ambil info nama lawan bicara
    result = []
    for r in rooms.values():
        user_res = sb.table("users").select("id, full_name, role, status").eq("id", r["other_user_id"]).single().execute()
        # Proteksi keamanan: Hanya tampilkan riwayat chat jika akun lawan bicara berstatus AKTIF
        if user_res.data and isinstance(user_res.data, dict) and user_res.data.get("status") == "active":
            r["other_user"] = user_res.data
            result.append(r)

    return {"status": "success", "data": result}

@router.get("/{room_id}/messages")
async def get_messages(room_id: str, current_user = Depends(get_current_user)):
    """Ambil semua pesan dalam sebuah room. Tandai pesan masuk sebagai 'sudah dibaca'."""
    uid = current_user["id"]
    res = sb.table("chats_human").select("*, users!sender_id(full_name, role)") \
        .eq("room_id", room_id).order("created_at").execute()

    # Tandai pesan yang diterima sebagai is_read=True
    sb.table("chats_human").update({"is_read": True}) \
        .eq("room_id", room_id).eq("receiver_id", uid).eq("is_read", False).execute()

    return {"status": "success", "data": res.data}

@router.post("/send")
async def send_message(payload: MessageCreate, current_user = Depends(get_current_user)):
    """Kirim pesan baru. Jika room_id tidak ada, buat room baru."""
    room_id = payload.room_id or get_or_create_room(current_user["id"], payload.receiver_id)
    data = {
        "room_id": room_id,
        "sender_id": current_user["id"],
        "receiver_id": payload.receiver_id,
        "message": payload.message,
        "is_read": False,
    }
    res = sb.table("chats_human").insert(data).execute()
    return {"status": "success", "data": res.data[0]}

@router.get("/users/contacts")
async def get_contacts(current_user = Depends(get_current_user)):
    """
    Daftar user yang bisa dihubungi.
    Parent → lihat caregiver saja.
    Caregiver → lihat parent saja.
    Admin → tidak bisa dichat oleh siapapun & tidak ada kontak.
    """
    role = current_user["role"]
    if role == "parent":
        query_roles = ["caregiver"]
    elif role == "caregiver":
        query_roles = ["parent"]
    else:
        # Khusus untuk role admin tidak bisa dichat oleh siapapun dan tidak bisa chat siapapun
        return {"status": "success", "data": []}

    # Hanya tampilkan pengguna yang status akunnya AKTIF (menghilangkan user yang dinonaktifkan/diblokir/pending)
    res = sb.table("users").select("id, full_name, role").in_("role", query_roles).eq("status", "active").execute()
    users_data = res.data

    # Jika yang login adalah caregiver, tambahkan informasi nama anak ke nama orang tua
    final_contacts = []
    raw_users = users_data if isinstance(users_data, list) else []
    
    if role == "caregiver":
        children_res = sb.table("children").select("parent_id, full_name").execute()
        parent_children_map = {}
        raw_kids = children_res.data if isinstance(children_res.data, list) else []
        
        for child in raw_kids:
            if not isinstance(child, dict):
                continue
            pid = child.get("parent_id")
            if pid:
                if pid not in parent_children_map:
                    parent_children_map[pid] = []
                parent_children_map[pid].append(str(child.get("full_name") or ""))
        
        for u in raw_users:
            if not isinstance(u, dict):
                continue
            contact = dict(u) # Copy to mutable dict
            uid = contact.get("id")
            if uid:
                kids = parent_children_map.get(uid)
                if kids:
                    kids_str = ", ".join(kids)
                    contact["full_name"] = f"{contact.get('full_name')} (Ortu dari {kids_str})"
            final_contacts.append(contact)
    else:
        for u in raw_users:
            if isinstance(u, dict):
                final_contacts.append(dict(u))

    return {"status": "success", "data": final_contacts}

