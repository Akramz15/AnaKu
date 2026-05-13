# MODUL-06 — Chat Manusia ke Manusia (Realtime)

> **Fase:** 6 | **Estimasi:** 1–2 hari | **Prasyarat:** MODUL-01

---

## Tujuan Modul

Orang tua dapat mengirim pesan langsung ke pihak daycare (caregiver/admin) dan sebaliknya. Chat menggunakan **Supabase Realtime** agar pesan muncul tanpa perlu refresh halaman.

---

## Checklist Tugas

- [ ] 6.1 Backend: Chat endpoints (rooms & messages)
- [ ] 6.2 Aktifkan Supabase Realtime pada tabel `chats_human`
- [ ] 6.3 Frontend: Chat UI untuk Parent
- [ ] 6.4 Frontend: Chat UI untuk Caregiver

---

## 6.1 — Backend: Chat Endpoints

### `backend/schemas/chat.py`
```python
from pydantic import BaseModel
from typing import Optional
import uuid

class MessageCreate(BaseModel):
    receiver_id: str
    message: str
    room_id: Optional[str] = None   # Jika None, buat room_id baru dari UUID
```

### `backend/api/endpoints/chats.py`
```python
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
    Parent → lihat caregiver & admin.
    Caregiver/Admin → lihat semua parent.
    """
    role = current_user["role"]
    if role == "parent":
        query_roles = ["caregiver", "admin"]
    else:
        query_roles = ["parent"]
    res = sb.table("users").select("id, full_name, role").in_("role", query_roles).execute()
    return {"status": "success", "data": res.data}
```

---

## 6.2 — Aktifkan Supabase Realtime

Di **Supabase Dashboard → Database → Replication**:
1. Klik **"Enable" pada tabel `chats_human`** untuk INSERT event
2. Atau jalankan SQL berikut:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats_human;
```

---

## 6.3 — Frontend: Chat UI (Komponen Reusable)

### `frontend/src/components/ChatWindow.jsx`
```jsx
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/axios'
import { useAuth } from '../context/AuthContext'

export default function ChatWindow({ roomId, receiverId, receiverName }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  // Load pesan awal
  useEffect(() => {
    if (!roomId) return
    api.get(`/api/v1/chats/${roomId}/messages`).then(r => setMessages(r.data.data))
  }, [roomId])

  // Supabase Realtime: subscribe pesan baru
  useEffect(() => {
    if (!roomId) return
    const channel = supabase.channel(`chat:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chats_human',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [roomId])

  // Auto-scroll ke bawah
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    await api.post('/api/v1/chats/send', {
      receiver_id: receiverId,
      message: text,
      room_id: roomId,
    })
    setText('')
  }

  return (
    <div style={styles.window}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.avatar}>{receiverName?.[0] || '?'}</div>
        <div style={styles.headerName}>{receiverName || 'Chat'}</div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map(msg => {
          const isOwn = msg.sender_id === profile?.id
          return (
            <div key={msg.id} style={{ display:'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom:'0.5rem' }}>
              <div style={{ ...styles.bubble, ...(isOwn ? styles.bubbleOwn : styles.bubbleOther) }}>
                {msg.message}
                <div style={styles.time}>
                  {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} style={styles.inputRow}>
        <input style={styles.input} placeholder="Ketik pesan..."
          value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" style={styles.sendBtn}>➤</button>
      </form>
    </div>
  )
}

const styles = {
  window:      { display:'flex', flexDirection:'column', height:'100%',
                 background:'var(--surface)', borderRadius:'var(--radius-lg)',
                 border:'1px solid var(--border)', overflow:'hidden' },
  header:      { display:'flex', alignItems:'center', gap:'0.75rem',
                 padding:'1rem 1.25rem', background:'var(--surface-2)',
                 borderBottom:'1px solid var(--border)' },
  avatar:      { width:'36px', height:'36px', borderRadius:'50%',
                 background:'var(--primary)', display:'flex', alignItems:'center',
                 justifyContent:'center', fontWeight:700, fontSize:'1rem', color:'#fff' },
  headerName:  { fontWeight:600 },
  messages:    { flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column' },
  bubble:      { maxWidth:'70%', padding:'0.6rem 0.9rem', borderRadius:'var(--radius-md)',
                 fontSize:'0.9rem', wordBreak:'break-word' },
  bubbleOwn:   { background:'var(--primary)', color:'#fff', borderBottomRightRadius:'4px' },
  bubbleOther: { background:'var(--surface-2)', color:'var(--text)', borderBottomLeftRadius:'4px' },
  time:        { fontSize:'0.65rem', opacity:0.6, marginTop:'0.25rem', textAlign:'right' },
  inputRow:    { display:'flex', gap:'0.5rem', padding:'0.75rem',
                 borderTop:'1px solid var(--border)' },
  input:       { flex:1, background:'var(--surface-2)', border:'1px solid var(--border)',
                 borderRadius:'var(--radius-md)', padding:'0.65rem 1rem',
                 color:'var(--text)', fontSize:'0.9rem' },
  sendBtn:     { background:'var(--primary)', color:'#fff', border:'none',
                 borderRadius:'var(--radius-md)', padding:'0 1.1rem',
                 fontSize:'1.1rem', cursor:'pointer' },
}
```

---

## 6.4 — Frontend: Halaman Chat (Parent & Caregiver)

### `frontend/src/pages/parent/ParentChat.jsx`
```jsx
import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import ChatWindow from '../../components/ChatWindow'

export default function ParentChat() {
  const [contacts, setContacts] = useState([])
  const [rooms, setRooms] = useState([])
  const [selected, setSelected] = useState(null) // { roomId, receiverId, name }

  useEffect(() => {
    api.get('/api/v1/chats/users/contacts').then(r => setContacts(r.data.data))
    api.get('/api/v1/chats/rooms').then(r => setRooms(r.data.data))
  }, [])

  const startChat = (contact) => {
    const existing = rooms.find(r => r.other_user_id === contact.id)
    setSelected({ roomId: existing?.room_id || null, receiverId: contact.id, name: contact.full_name })
  }

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <h3 style={styles.sideTitle}>💬 Pesan</h3>
        {contacts.map(c => (
          <div key={c.id} style={{...styles.contactCard, ...(selected?.receiverId===c.id ? styles.contactActive : {})}}
            onClick={() => startChat(c)}>
            <div style={styles.avatar}>{c.full_name[0]}</div>
            <div>
              <div style={styles.contactName}>{c.full_name}</div>
              <div style={styles.contactRole}>{c.role === 'caregiver' ? 'Pengasuh' : 'Admin'}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={styles.chatArea}>
        {selected
          ? <ChatWindow roomId={selected.roomId} receiverId={selected.receiverId} receiverName={selected.name} />
          : <div style={styles.empty}>Pilih kontak untuk memulai chat</div>
        }
      </div>
    </div>
  )
}

const styles = {
  page:          { display:'flex', height:'calc(100vh - 80px)', padding:'1rem', gap:'1rem' },
  sidebar:       { width:'280px', background:'var(--surface)', borderRadius:'var(--radius-lg)',
                   border:'1px solid var(--border)', overflowY:'auto', padding:'1rem' },
  sideTitle:     { fontWeight:700, marginBottom:'1rem', fontSize:'1rem' },
  contactCard:   { display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem',
                   borderRadius:'var(--radius-md)', cursor:'pointer', marginBottom:'0.5rem',
                   transition:'background 0.2s' },
  contactActive: { background:'var(--surface-2)', borderLeft:'3px solid var(--primary)' },
  avatar:        { width:'38px', height:'38px', borderRadius:'50%', background:'var(--primary)',
                   display:'flex', alignItems:'center', justifyContent:'center',
                   fontWeight:700, color:'#fff', flexShrink:0 },
  contactName:   { fontWeight:600, fontSize:'0.9rem' },
  contactRole:   { fontSize:'0.75rem', color:'var(--text-muted)' },
  chatArea:      { flex:1 },
  empty:         { display:'flex', alignItems:'center', justifyContent:'center',
                   height:'100%', color:'var(--text-muted)', fontSize:'0.95rem',
                   background:'var(--surface)', borderRadius:'var(--radius-lg)',
                   border:'1px solid var(--border)' },
}
```

> **Note:** Untuk `CaregiverChat.jsx`, strukturnya identik dengan `ParentChat.jsx` — contacts yang muncul akan berisi user dengan role `parent` (karena endpoint `/users/contacts` sudah menyesuaikan berdasarkan role yang login).

---

## Verifikasi Modul-06

| Test | Expected |
|------|----------|
| Parent buka `/parent/chat` | Daftar caregiver/admin muncul |
| Parent klik kontak → kirim pesan | Pesan muncul di bubble kanan |
| Caregiver buka chat yang sama | Pesan parent terlihat di kiri |
| Caregiver balas → Parent tidak refresh | Pesan caregiver muncul realtime di sisi parent |
| `GET /api/v1/chats/rooms` | Daftar room dengan pesan terakhir |
