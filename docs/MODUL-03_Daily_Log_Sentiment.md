# MODUL-03 — Smart Daily Log + AI Sentiment Analysis (Feature B)

> **Fase:** 3 | **Estimasi:** 1–2 hari | **Prasyarat:** MODUL-01, MODUL-02

---

## Tujuan Modul

Pengasuh mengisi laporan harian anak via form tap-based yang cepat dan intuitif. Saat form disimpan, FastAPI secara **asinkron** mengirim teks catatan ke Gemini API untuk dianalisis sentimennya (Positif/Netral/Negatif), lalu hasilnya disimpan kembali ke database.

---

## Checklist Tugas

- [ ] 3.1 Backend: Pydantic schema Daily Log
- [ ] 3.2 Backend: Endpoint POST & GET daily logs
- [ ] 3.3 Backend: AI Sentiment Analysis (Background Task)
- [ ] 3.4 Frontend: Form Smart Daily Log (Caregiver)
- [ ] 3.5 Frontend: Riwayat log harian (Caregiver Dashboard)

---

## 3.1 — Schema: Daily Log

### `backend/schemas/daily_log.py`
```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class DailyLogCreate(BaseModel):
    child_id: str
    log_date: Optional[date] = None
    meal_morning: Optional[str] = None   # habis|setengah|tidak_makan
    meal_lunch: Optional[str] = None
    meal_snack: Optional[str] = None
    sleep_duration_min: Optional[int] = None
    sleep_quality: Optional[str] = None  # nyenyak|gelisah|tidak_tidur
    mood: Optional[str] = None           # ceria|biasa|rewel|menangis
    activities: Optional[List[str]] = []
    special_notes: Optional[str] = None
    toilet_count: Optional[int] = 0
    health_notes: Optional[str] = None
```

---

## 3.2 — Backend: Endpoint Daily Logs

### `backend/api/endpoints/daily_logs.py`
```python
from fastapi import APIRouter, Depends, BackgroundTasks
from datetime import date as date_type
from api.deps import get_current_user, require_role
from schemas.daily_log import DailyLogCreate
from services.ai_service import analyze_sentiment
from supabase import create_client
from core.config import settings

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.post("/", dependencies=[Depends(require_role("caregiver"))])
async def create_daily_log(
    payload: DailyLogCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """
    Caregiver input laporan harian.
    Setelah disimpan, Sentiment Analysis dijalankan di background.
    """
    data = payload.model_dump()
    data["caregiver_id"] = current_user["id"]
    if data.get("log_date"):
        data["log_date"] = data["log_date"].isoformat()
    else:
        data["log_date"] = date_type.today().isoformat()

    # Simpan log ke database
    res = sb.table("daily_logs").upsert(data, on_conflict="child_id,log_date").execute()
    log_id = res.data[0]["id"]

    # Jalankan sentiment analysis di background (non-blocking)
    text_to_analyze = f"{payload.special_notes or ''} {payload.mood or ''}"
    if text_to_analyze.strip():
        background_tasks.add_task(analyze_sentiment, log_id, text_to_analyze)

    return {"status": "success", "data": res.data[0]}

@router.get("/")
async def get_daily_logs(
    child_id: str = None,
    log_date: str = None,
    current_user = Depends(get_current_user)
):
    """Ambil daily logs. Filter: child_id, log_date."""
    query = sb.table("daily_logs").select("*, children(full_name), users!caregiver_id(full_name)")
    if child_id:
        query = query.eq("child_id", child_id)
    if log_date:
        query = query.eq("log_date", log_date)
    if current_user["role"] == "parent":
        # Parent hanya lihat anaknya sendiri
        kids = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        child_ids = [k["id"] for k in kids.data]
        query = query.in_("child_id", child_ids)
    res = query.order("log_date", desc=True).execute()
    return {"status": "success", "data": res.data}

@router.get("/sentiment-trend")
async def get_sentiment_trend(child_id: str, current_user = Depends(get_current_user)):
    """
    Ambil data sentimen 7 hari terakhir untuk grafik tren emosi.
    Return: list [{log_date, sentiment_label, sentiment_score}]
    """
    from datetime import date, timedelta
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
    res = sb.table("daily_logs") \
        .select("log_date, sentiment_label, sentiment_score, mood") \
        .eq("child_id", child_id) \
        .gte("log_date", seven_days_ago) \
        .order("log_date").execute()
    return {"status": "success", "data": res.data}
```

---

## 3.3 — AI Service: Sentiment Analysis

### `backend/services/ai_service.py`
```python
import google.generativeai as genai
from core.config import settings
from supabase import create_client

genai.configure(api_key=settings.GEMINI_API_KEY)
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# ── Feature B: Sentiment Analysis ────────────────────────────────────────────
async def analyze_sentiment(log_id: str, text: str):
    """
    Kirim teks ke Gemini, dapatkan label + skor sentimen,
    lalu update tabel daily_logs.
    Dipanggil sebagai BackgroundTask setelah daily log tersimpan.
    """
    prompt = f"""Kamu adalah analis emosi anak di daycare.
Analisis teks berikut dari perspektif kondisi emosi anak.
Klasifikasikan ke salah satu: positif, netral, atau negatif.
Berikan juga skor keyakinan antara 0.0 hingga 1.0.

Teks: "{text}"

Jawab HANYA dalam format JSON berikut (tanpa teks lain):
{{"label": "positif|netral|negatif", "score": 0.0}}"""

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        import json, re
        json_match = re.search(r'\{.*?\}', response.text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            sb.table("daily_logs").update({
                "sentiment_label": result.get("label", "netral"),
                "sentiment_score": result.get("score", 0.5)
            }).eq("id", log_id).execute()
    except Exception as e:
        print(f"[Sentiment Error] log_id={log_id}: {e}")

# ── Feature C: AI Daily Summary ───────────────────────────────────────────────
async def generate_daily_summary(child_id: str, log_date: str):
    """
    Dipanggil saat checkout. Baca daily_log hari ini,
    minta Gemini buat cerita hangat, simpan ke ai_daily_summary.
    """
    log_res = sb.table("daily_logs").select("*, children(full_name)") \
        .eq("child_id", child_id).eq("log_date", log_date).single().execute()
    if not log_res.data:
        return

    log = log_res.data
    child_name = log.get("children", {}).get("full_name", "Si kecil")
    meal_map = {"habis": "menghabiskan", "setengah": "hanya setengah", "tidak_makan": "tidak makan"}
    mood_map = {"ceria": "sangat ceria", "biasa": "baik-baik saja", "rewel": "sedikit rewel", "menangis": "cukup banyak menangis"}

    prompt = f"""Buatkan satu paragraf cerita yang HANGAT, PERSONAL, dan MENYENANGKAN
dalam Bahasa Indonesia untuk orang tua tentang hari ini {child_name} di daycare.

Data hari ini:
- Makan pagi: {meal_map.get(log.get('meal_morning',''),'tidak tercatat')}
- Makan siang: {meal_map.get(log.get('meal_lunch',''),'tidak tercatat')}
- Snack: {meal_map.get(log.get('meal_snack',''),'tidak tercatat')}
- Tidur siang: {log.get('sleep_duration_min', 0)} menit ({log.get('sleep_quality','')})
- Mood: {mood_map.get(log.get('mood',''),'tidak tercatat')}
- Aktivitas: {', '.join(log.get('activities') or ['bermain'])}
- Catatan pengasuh: {log.get('special_notes') or 'tidak ada catatan khusus'}

Gunakan nama {child_name}. Tulis dengan hangat, seperti surat singkat dari pengasuh.
Panjang: 3–4 kalimat. Jangan gunakan bullet point."""

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        from datetime import datetime, timezone
        sb.table("daily_logs").update({
            "ai_daily_summary": response.text.strip(),
            "summary_generated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", log["id"]).execute()
    except Exception as e:
        print(f"[Summary Error] child_id={child_id}: {e}")
```

---

## 3.4 — Frontend: Smart Daily Log Form

### `frontend/src/pages/caregiver/DailyLogForm.jsx`
```jsx
import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'

const MEAL_OPTS = [
  { value:'habis',       label:'🍽️ Habis',    color:'#43D9AD' },
  { value:'setengah',    label:'🥣 Setengah', color:'#FFBA08' },
  { value:'tidak_makan', label:'❌ Tidak Makan', color:'#FF6584' },
]
const SLEEP_OPTS = [
  { value:'nyenyak',    label:'😴 Nyenyak',  color:'#43D9AD' },
  { value:'gelisah',    label:'😟 Gelisah',  color:'#FFBA08' },
  { value:'tidak_tidur',label:'😵 Tidak Tidur', color:'#FF6584' },
]
const MOOD_OPTS = [
  { value:'ceria',    label:'😄 Ceria',    color:'#43D9AD' },
  { value:'biasa',    label:'😊 Biasa',    color:'#6C63FF' },
  { value:'rewel',    label:'😤 Rewel',    color:'#FFBA08' },
  { value:'menangis', label:'😢 Menangis', color:'#FF6584' },
]
const ACTIVITY_OPTS = ['Mewarnai','Bermain Balok','Bernyanyi','Membaca','Olahraga','Bermain Pasir','Menggambar','Bermain Air']

export default function DailyLogForm() {
  const [children, setChildren] = useState([])
  const [form, setForm] = useState({
    child_id:'', meal_morning:'', meal_lunch:'', meal_snack:'',
    sleep_duration_min:60, sleep_quality:'', mood:'',
    activities:[], special_notes:'', toilet_count:0, health_notes:''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/api/v1/children').then(r => setChildren(r.data.data))
  }, [])

  const toggle = (field, value) => {
    setForm(f => ({ ...f, [field]: f[field] === value ? '' : value }))
  }
  const toggleActivity = (act) => {
    setForm(f => ({
      ...f,
      activities: f.activities.includes(act)
        ? f.activities.filter(a => a !== act)
        : [...f.activities, act]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.child_id) { toast.error('Pilih anak terlebih dahulu'); return }
    setLoading(true)
    try {
      await api.post('/api/v1/daily-logs', form)
      toast.success('Laporan harian tersimpan! Analisis sentimen sedang diproses...')
      setForm(f => ({ ...f, meal_morning:'', meal_lunch:'', meal_snack:'',
        sleep_quality:'', mood:'', activities:[], special_notes:'', health_notes:'', toilet_count:0 }))
    } catch(e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan laporan')
    }
    setLoading(false)
  }

  const TapGroup = ({ label, options, field }) => (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>{label}</div>
      <div style={styles.tapGroup}>
        {options.map(opt => (
          <button key={opt.value} type="button"
            style={{ ...styles.tapBtn, ...(form[field] === opt.value ? { background: opt.color, color:'#0F0F1A', borderColor: opt.color } : {}) }}
            onClick={() => toggle(field, opt.value)}>{opt.label}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>📋 Smart Daily Log</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Pilih Anak */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>👶 Anak</div>
          <select style={styles.select} value={form.child_id}
            onChange={e => setForm(f => ({...f, child_id: e.target.value}))} required>
            <option value="">-- Pilih Anak --</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>

        <TapGroup label="🌅 Makan Pagi" options={MEAL_OPTS} field="meal_morning" />
        <TapGroup label="☀️ Makan Siang" options={MEAL_OPTS} field="meal_lunch" />
        <TapGroup label="🍎 Snack" options={MEAL_OPTS} field="meal_snack" />
        <TapGroup label="😴 Kualitas Tidur Siang" options={SLEEP_OPTS} field="sleep_quality" />
        <TapGroup label="😊 Mood Hari Ini" options={MOOD_OPTS} field="mood" />

        {/* Durasi Tidur */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>⏱️ Durasi Tidur Siang: <strong>{form.sleep_duration_min} menit</strong></div>
          <input type="range" min={0} max={180} step={10} style={{ width:'100%' }}
            value={form.sleep_duration_min}
            onChange={e => setForm(f => ({...f, sleep_duration_min: Number(e.target.value)}))} />
        </div>

        {/* Aktivitas */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>🎨 Aktivitas</div>
          <div style={styles.tapGroup}>
            {ACTIVITY_OPTS.map(act => (
              <button key={act} type="button"
                style={{...styles.tapBtn, ...(form.activities.includes(act) ? {background:'var(--primary)', color:'#fff', borderColor:'var(--primary)'} : {})}}
                onClick={() => toggleActivity(act)}>{act}</button>
            ))}
          </div>
        </div>

        {/* Toilet Count */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>🚽 Jumlah BAB/BAK: <strong>{form.toilet_count}x</strong></div>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button type="button" style={styles.counterBtn} onClick={() => setForm(f => ({...f, toilet_count: Math.max(0, f.toilet_count-1)}))}>−</button>
            <button type="button" style={styles.counterBtn} onClick={() => setForm(f => ({...f, toilet_count: f.toilet_count+1}))}>+</button>
          </div>
        </div>

        {/* Catatan Khusus */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>📝 Catatan Khusus (untuk Analisis AI)</div>
          <textarea style={styles.textarea} rows={3}
            placeholder="Ceritakan kondisi anak hari ini secara singkat..."
            value={form.special_notes}
            onChange={e => setForm(f => ({...f, special_notes: e.target.value}))} />
        </div>

        {/* Catatan Kesehatan */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>🏥 Catatan Kesehatan (opsional)</div>
          <input style={styles.input} placeholder="Misal: demam ringan, batuk..."
            value={form.health_notes}
            onChange={e => setForm(f => ({...f, health_notes: e.target.value}))} />
        </div>

        <button type="submit" style={styles.submitBtn} disabled={loading}>
          {loading ? 'Menyimpan...' : '💾 Simpan Laporan Harian'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  page:         { padding:'2rem', maxWidth:'680px', margin:'0 auto' },
  title:        { fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' },
  form:         { display:'flex', flexDirection:'column', gap:'1.25rem' },
  section:      { background:'var(--surface)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-md)', padding:'1.25rem' },
  sectionLabel: { fontWeight:600, marginBottom:'0.75rem', fontSize:'0.95rem' },
  tapGroup:     { display:'flex', flexWrap:'wrap', gap:'0.5rem' },
  tapBtn:       { background:'var(--surface-2)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)', padding:'0.5rem 1rem',
                  color:'var(--text-muted)', cursor:'pointer', fontSize:'0.85rem',
                  transition:'all 0.2s' },
  select:       { width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)', padding:'0.75rem', color:'var(--text)' },
  textarea:     { width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)', padding:'0.75rem', color:'var(--text)',
                  resize:'none' },
  input:        { width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)', padding:'0.75rem', color:'var(--text)' },
  counterBtn:   { background:'var(--primary)', color:'#fff', border:'none',
                  borderRadius:'var(--radius-sm)', padding:'0.4rem 1rem',
                  fontSize:'1.25rem', cursor:'pointer' },
  submitBtn:    { background:'linear-gradient(135deg,var(--primary),var(--secondary))',
                  color:'#fff', border:'none', borderRadius:'var(--radius-md)',
                  padding:'1rem', fontWeight:700, fontSize:'1rem', cursor:'pointer',
                  boxShadow:'var(--shadow-lg)' },
}
```

---

## Verifikasi Modul-03

| Test | Expected |
|------|----------|
| Caregiver isi form + submit | `200 OK`, toast sukses |
| Cek DB `daily_logs` setelah 5–10 detik | Kolom `sentiment_label` & `sentiment_score` terisi |
| Submit form tanpa pilih anak | Toast error |
| `GET /api/v1/daily-logs?child_id=...` sebagai parent | Hanya data anak miliknya |
| `GET /api/v1/daily-logs/sentiment-trend?child_id=...` | Array 7 hari dengan label sentimen |
