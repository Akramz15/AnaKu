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
    if res.data:
        return res.data[0]["room_id"]
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
    for msg in res.data:
        rid = msg["room_id"]
        if rid not in rooms:
            other_id = msg["receiver_id"] if msg["sender_id"] == uid else msg["sender_id"]
            rooms[rid] = {"room_id": rid, "other_user_id": other_id,
                          "last_message": msg["message"], "last_time": msg["created_at"]}

    # Ambil info nama lawan bicara
    result = []
    for r in rooms.values():
        user_res = sb.table("users").select("id, full_name, role").eq("id", r["other_user_id"]).single().execute()
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

    res = sb.table("users").select("id, full_name, role").in_("role", query_roles).execute()
    users_data = res.data

    # Jika yang login adalah caregiver, tambahkan informasi nama anak ke nama orang tua
    if role == "caregiver":
        children_res = sb.table("children").select("parent_id, full_name").execute()
        parent_children_map = {}
        for child in children_res.data:
            pid = child.get("parent_id")
            if pid:
                if pid not in parent_children_map:
                    parent_children_map[pid] = []
                parent_children_map[pid].append(child.get("full_name"))
        
        for u in users_data:
            kids = parent_children_map.get(u["id"])
            if kids:
                kids_str = ", ".join(kids)
                u["full_name"] = f"{u['full_name']} (Ortu dari {kids_str})"

    return {"status": "success", "data": users_data}

