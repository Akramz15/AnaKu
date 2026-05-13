# MODUL-07 — 3 Inovasi Fitur AI (Chatbot, Sentiment, Cerita Harian)

> **Fase:** 7 | **Estimasi:** 2–3 hari | **Prasyarat:** MODUL-03, MODUL-02

---

## Tujuan Modul

Mengimplementasikan 3 fitur AI inti menggunakan Google Gemini API:
- **Feature A:** AI Chatbot untuk orang tua (tanya jawab tentang kondisi anak hari ini)
- **Feature B:** Sentiment Analysis pada catatan pengasuh *(sudah diimplementasi di MODUL-03, modul ini menambahkan frontend grafik)*
- **Feature C:** Cerita Rangkuman Harian otomatis saat checkout *(backend sudah di MODUL-02 & 03)*

---

## Checklist Tugas

- [ ] 7A.1 Backend: Gemini client setup
- [ ] 7A.2 Backend: Endpoint AI Chatbot
- [ ] 7A.3 Frontend: Halaman AI Chatbot (Parent)
- [ ] 7B.1 Frontend: Grafik Tren Emosi Mingguan (Parent Dashboard)
- [ ] 7C.1 Frontend: Kartu Cerita Harian (Parent Dashboard)

---

## 7A.1 — Backend: Gemini Client

### `backend/core/gemini.py`
```python
import google.generativeai as genai
from core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

def get_chat_model():
    """Buat instance GenerativeModel untuk chatbot (dengan riwayat percakapan)"""
    return genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction="""Kamu adalah Asisten AnaKu yang ramah, hangat, dan empatik.
Kamu membantu orang tua memahami kondisi anak mereka di daycare.
Selalu jawab dalam Bahasa Indonesia yang santai, hangat, dan menenangkan.
Jika ditanya tentang kondisi anak, gunakan data log harian yang diberikan sebagai konteks.
Jika data tidak tersedia, informasikan dengan lembut dan sarankan untuk menghubungi pengasuh.
Jangan membuat asumsi medis. Selalu akhiri dengan kalimat yang menenangkan orang tua."""
    )

def get_general_model():
    """Model standar untuk analisis satu kali (sentiment, summary)"""
    return genai.GenerativeModel("gemini-1.5-flash")
```

---

## 7A.2 — Backend: Endpoint AI Chatbot

### `backend/schemas/ai.py`
```python
from pydantic import BaseModel
from typing import Optional

class ChatbotRequest(BaseModel):
    child_id: str
    message: str
    log_date: Optional[str] = None   # Format: YYYY-MM-DD. Default: hari ini
```

### `backend/api/endpoints/ai.py`
```python
from fastapi import APIRouter, Depends
from api.deps import get_current_user, require_role
from schemas.ai import ChatbotRequest
from core.gemini import get_chat_model
from supabase import create_client
from core.config import settings
from datetime import date

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def build_log_context(log: dict, child_name: str) -> str:
    """Ubah raw daily_log dict menjadi teks konteks yang bisa dimengerti Gemini"""
    meal_map  = {"habis":"menghabiskan porsinya", "setengah":"hanya makan setengah porsi", "tidak_makan":"tidak makan"}
    sleep_map = {"nyenyak":"tidur dengan nyenyak", "gelisah":"tidur tapi gelisah", "tidak_tidur":"tidak tidur siang"}
    mood_map  = {"ceria":"sangat ceria dan aktif", "biasa":"dalam kondisi normal", "rewel":"sedikit rewel", "menangis":"banyak menangis"}

    ctx = f"""=== DATA LOG HARIAN {child_name} ({log.get('log_date','')}) ===
Makan Pagi   : {meal_map.get(log.get('meal_morning',''), 'tidak tercatat')}
Makan Siang  : {meal_map.get(log.get('meal_lunch',''), 'tidak tercatat')}
Snack        : {meal_map.get(log.get('meal_snack',''), 'tidak tercatat')}
Tidur Siang  : {log.get('sleep_duration_min', 0)} menit — {sleep_map.get(log.get('sleep_quality',''), 'tidak tercatat')}
Mood         : {child_name} {mood_map.get(log.get('mood',''), 'tidak tercatat')}
Aktivitas    : {', '.join(log.get('activities') or ['tidak tercatat'])}
Catatan      : {log.get('special_notes') or 'Tidak ada catatan khusus'}
Kesehatan    : {log.get('health_notes') or 'Normal'}
Sentimen     : {log.get('sentiment_label','belum dianalisis')} (skor: {log.get('sentiment_score', '-')})
Cerita AI    : {log.get('ai_daily_summary') or 'Belum tersedia (anak belum checkout)'}
=== AKHIR DATA ==="""
    return ctx

@router.post("/chat", dependencies=[Depends(require_role("parent"))])
async def ai_chatbot(payload: ChatbotRequest, current_user = Depends(get_current_user)):
    """
    Feature A: AI Chatbot untuk orang tua.
    1. Ambil data log harian anak sebagai konteks.
    2. Ambil riwayat percakapan dari DB (max 10 pesan terakhir).
    3. Kirim ke Gemini dengan konteks log.
    4. Simpan pesan user & respons AI ke chats_ai.
    """
    target_date = payload.log_date or date.today().isoformat()

    # 1. Ambil data anak
    child_res = sb.table("children").select("full_name, parent_id") \
        .eq("id", payload.child_id).single().execute()
    if not child_res.data or child_res.data["parent_id"] != current_user["id"]:
        return {"status": "error", "message": "Anak tidak ditemukan atau bukan milik Anda"}
    child_name = child_res.data["full_name"]

    # 2. Ambil daily log hari ini
    log_res = sb.table("daily_logs").select("*") \
        .eq("child_id", payload.child_id).eq("log_date", target_date).execute()
    log_context = build_log_context(log_res.data[0], child_name) if log_res.data else \
        f"Belum ada data log untuk {child_name} pada tanggal {target_date}."

    # 3. Ambil riwayat chat AI (10 pesan terakhir) untuk maintain konteks
    history_res = sb.table("chats_ai").select("role, message") \
        .eq("parent_id", current_user["id"]).eq("child_id", payload.child_id) \
        .order("created_at", desc=True).limit(10).execute()
    # Balik urutan (oldest first untuk Gemini history)
    history = [{"role": h["role"], "parts": [h["message"]]} for h in reversed(history_res.data)]

    # 4. Bangun model & kirim ke Gemini
    model = get_chat_model()
    chat  = model.start_chat(history=history)
    full_prompt = f"{log_context}\n\nPertanyaan orang tua: {payload.message}"
    response = chat.send_message(full_prompt)
    ai_reply = response.text

    # 5. Simpan pesan user & AI ke DB
    log_id = log_res.data[0]["id"] if log_res.data else None
    sb.table("chats_ai").insert([
        {"parent_id": current_user["id"], "child_id": payload.child_id,
         "role": "user", "message": payload.message, "context_log_id": log_id},
        {"parent_id": current_user["id"], "child_id": payload.child_id,
         "role": "model", "message": ai_reply, "context_log_id": log_id},
    ]).execute()

    return {"status": "success", "data": {"reply": ai_reply}}

@router.get("/chat/history", dependencies=[Depends(require_role("parent"))])
async def get_chat_history(child_id: str, current_user = Depends(get_current_user)):
    """Ambil riwayat chat AI untuk ditampilkan di frontend"""
    res = sb.table("chats_ai").select("*") \
        .eq("parent_id", current_user["id"]).eq("child_id", child_id) \
        .order("created_at").execute()
    return {"status": "success", "data": res.data}
```

---

## 7A.3 — Frontend: Halaman AI Chatbot (Parent)

### `frontend/src/pages/parent/AIChatbot.jsx`
```jsx
import { useEffect, useRef, useState } from 'react'
import api from '../../lib/axios'
import { useAuth } from '../../context/AuthContext'

const BOT_AVATAR = '🤖'
const USER_AVATAR = '👩'

export default function AIChatbot() {
  const { profile } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      setChildren(r.data.data)
      if (r.data.data[0]) setSelectedChild(r.data.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    api.get(`/api/v1/ai/chat/history?child_id=${selectedChild}`).then(r => {
      const hist = r.data.data.map(m => ({
        role: m.role, text: m.message, time: m.created_at
      }))
      setMessages(hist.length > 0 ? hist : [
        { role:'model', text:`Halo! Saya Asisten AnaKu 🌟 Saya siap membantu Anda memahami kondisi si kecil hari ini. Silakan tanyakan apa saja!`, time: new Date().toISOString() }
      ])
    })
  }, [selectedChild])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || !selectedChild) return

    const userMsg = { role:'user', text: input, time: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/api/v1/ai/chat', { child_id: selectedChild, message: input })
      setMessages(prev => [...prev, { role:'model', text: res.data.data.reply, time: new Date().toISOString() }])
    } catch {
      setMessages(prev => [...prev, { role:'model', text:'Maaf, terjadi gangguan. Silakan coba lagi.', time: new Date().toISOString() }])
    }
    setLoading(false)
  }

  const QUICK_QUESTIONS = [
    'Hari ini anak saya makan dengan baik tidak?',
    'Bagaimana suasana hati anak saya hari ini?',
    'Berapa lama anak saya tidur siang?',
    'Apa saja kegiatan anak saya hari ini?',
  ]

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🤖 Asisten AnaKu AI</h2>
          <p style={styles.sub}>Tanya apa saja tentang kondisi si kecil hari ini</p>
        </div>
        {children.length > 1 && (
          <select style={styles.childSelect} value={selectedChild}
            onChange={e => setSelectedChild(e.target.value)}>
            {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        )}
      </div>

      {/* Chat Area */}
      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', justifyContent: msg.role==='user' ? 'flex-end' : 'flex-start',
            marginBottom:'1rem', gap:'0.5rem', alignItems:'flex-end' }}>
            {msg.role === 'model' && <div style={styles.botAvatar}>{BOT_AVATAR}</div>}
            <div style={{ maxWidth:'75%' }}>
              <div style={{ ...styles.bubble, ...(msg.role==='user' ? styles.userBubble : styles.botBubble) }}>
                {msg.text}
              </div>
              <div style={styles.msgTime}>
                {new Date(msg.time).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
              </div>
            </div>
            {msg.role === 'user' && <div style={styles.userAvatar}>{USER_AVATAR}</div>}
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <div style={styles.botAvatar}>{BOT_AVATAR}</div>
            <div style={{ ...styles.bubble, ...styles.botBubble, color:'var(--text-muted)' }}>
              ✨ Sedang berpikir...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Questions */}
      <div style={styles.quickWrap}>
        {QUICK_QUESTIONS.map((q, i) => (
          <button key={i} style={styles.quickBtn} onClick={() => setInput(q)}>{q}</button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={styles.inputRow}>
        <input style={styles.input} placeholder="Tanyakan sesuatu tentang si kecil..."
          value={input} onChange={e => setInput(e.target.value)} disabled={loading} />
        <button type="submit" style={styles.sendBtn} disabled={loading || !input.trim()}>
          {loading ? '⏳' : '➤'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  page:        { display:'flex', flexDirection:'column', height:'calc(100vh - 64px)',
                 padding:'1.5rem', gap:'1rem', maxWidth:'760px', margin:'0 auto' },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  title:       { fontSize:'1.4rem', fontWeight:700 },
  sub:         { color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem' },
  childSelect: { background:'var(--surface-2)', border:'1px solid var(--border)',
                 borderRadius:'var(--radius-md)', padding:'0.5rem 0.75rem', color:'var(--text)' },
  chatBox:     { flex:1, overflowY:'auto', background:'var(--surface)',
                 borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding:'1.25rem' },
  botAvatar:   { fontSize:'1.5rem', flexShrink:0 },
  userAvatar:  { fontSize:'1.5rem', flexShrink:0 },
  bubble:      { padding:'0.75rem 1rem', borderRadius:'var(--radius-md)',
                 fontSize:'0.9rem', lineHeight:1.6 },
  botBubble:   { background:'var(--surface-2)', borderBottomLeftRadius:'4px' },
  userBubble:  { background:'var(--primary)', color:'#fff', borderBottomRightRadius:'4px' },
  msgTime:     { fontSize:'0.65rem', color:'var(--text-muted)', marginTop:'0.2rem',
                 textAlign:'right' },
  quickWrap:   { display:'flex', flexWrap:'wrap', gap:'0.5rem' },
  quickBtn:    { background:'var(--surface-2)', border:'1px solid var(--border)',
                 borderRadius:'999px', padding:'0.4rem 0.9rem', color:'var(--text-muted)',
                 cursor:'pointer', fontSize:'0.8rem', transition:'all 0.2s' },
  inputRow:    { display:'flex', gap:'0.5rem' },
  input:       { flex:1, background:'var(--surface)', border:'1px solid var(--border)',
                 borderRadius:'var(--radius-md)', padding:'0.75rem 1rem',
                 color:'var(--text)', fontSize:'0.9rem' },
  sendBtn:     { background:'var(--primary)', color:'#fff', border:'none',
                 borderRadius:'var(--radius-md)', padding:'0 1.25rem',
                 fontSize:'1.1rem', cursor:'pointer', fontWeight:700 },
}
```

---

## 7B — Grafik Tren Emosi (Frontend)

### `frontend/src/components/charts/EmotionTrendChart.jsx`
```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'

const SENTIMENT_COLORS = { positif:'#43D9AD', netral:'#6C63FF', negatif:'#FF6584' }
const SENTIMENT_LABELS = { positif:'😄 Ceria', netral:'😊 Normal', negatif:'😤 Rewel' }

export default function EmotionTrendChart({ data }) {
  // data: [{log_date, sentiment_label, mood}]
  const chartData = data.map(d => ({
    date: new Date(d.log_date).toLocaleDateString('id-ID', { weekday:'short', day:'numeric' }),
    sentimen: d.sentiment_label || 'netral',
    nilai: d.sentiment_label === 'positif' ? 3 : d.sentiment_label === 'netral' ? 2 : 1,
    color: SENTIMENT_COLORS[d.sentiment_label] || '#6C63FF',
    label: SENTIMENT_LABELS[d.sentiment_label] || '😊 Normal',
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)',
        borderRadius:'8px', padding:'0.75rem', fontSize:'0.85rem' }}>
        <div style={{ fontWeight:600 }}>{d.date}</div>
        <div style={{ color: d.color, marginTop:'0.25rem' }}>{d.label}</div>
      </div>
    )
  }

  return (
    <div style={{ width:'100%', height:'200px' }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top:5, right:5, bottom:5, left:-20 }}>
          <XAxis dataKey="date" tick={{ fill:'#8888AA', fontSize:11 }} />
          <YAxis domain={[0,4]} ticks={[1,2,3]}
            tickFormatter={v => v===3?'😄':v===2?'😊':'😤'}
            tick={{ fontSize:14 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="nilai" radius={[6,6,0,0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

## 7C — Kartu Cerita Harian (Frontend)

### `frontend/src/components/DailyStoryCard.jsx`
```jsx
export default function DailyStoryCard({ story, childName, generatedAt }) {
  if (!story) return (
    <div style={styles.card}>
      <div style={styles.icon}>📖</div>
      <div style={styles.title}>Cerita Hari Ini</div>
      <p style={styles.empty}>
        Cerita harian akan muncul setelah {childName} check-out dari daycare.
      </p>
    </div>
  )

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.icon}>📖</span>
        <div>
          <div style={styles.title}>Cerita Hari Ini</div>
          {generatedAt && (
            <div style={styles.time}>
              Dibuat {new Date(generatedAt).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
            </div>
          )}
        </div>
      </div>
      <p style={styles.story}>"{story}"</p>
      <div style={styles.footer}>✨ Dibuat oleh AnaKu AI</div>
    </div>
  )
}

const styles = {
  card:   { background:'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
            border:'1px solid rgba(108,99,255,0.3)', borderRadius:'var(--radius-lg)',
            padding:'1.5rem', position:'relative', overflow:'hidden' },
  header: { display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' },
  icon:   { fontSize:'1.75rem' },
  title:  { fontWeight:700, fontSize:'1rem' },
  time:   { color:'var(--text-muted)', fontSize:'0.75rem' },
  story:  { fontSize:'0.95rem', lineHeight:1.8, color:'#C8C8E8',
            fontStyle:'italic', marginBottom:'1rem' },
  empty:  { color:'var(--text-muted)', fontSize:'0.9rem', lineHeight:1.6, marginTop:'0.5rem' },
  footer: { fontSize:'0.75rem', color:'var(--primary)', fontWeight:600 },
}
```

---

## Verifikasi Modul-07

| Test | Expected |
|------|----------|
| Parent tanya "anak saya makan apa?" | Gemini menjawab berdasarkan data log |
| Tanya tanpa log tersedia | AI menjawab dengan sopan bahwa data belum ada |
| Riwayat chat tersimpan di DB | Tabel `chats_ai` terisi dengan role user/model |
| Grafik emosi tampil | Bar chart 7 hari dengan warna berbeda per sentimen |
| Cerita harian sebelum checkout | Tampilkan placeholder |
| Cerita harian setelah checkout | Paragraf cerita hangat dari Gemini tampil |
