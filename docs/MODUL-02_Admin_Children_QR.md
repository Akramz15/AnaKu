# MODUL-02 — Admin: Manajemen Anak & QR Code Presensi

> **Fase:** 2 | **Estimasi:** 1–2 hari | **Prasyarat:** MODUL-01 selesai

---

## Tujuan Modul

Membangun fitur admin untuk mendaftarkan anak, generate QR Code unik per anak, dan melakukan scan QR untuk proses check-in/check-out. Checkout akan otomatis men-trigger pembuatan AI Story (Feature C dari MODUL-07).

---

## Checklist Tugas

- [ ] 2.1 Backend: Children CRUD endpoint
- [ ] 2.2 Backend: QR Code Generator endpoint
- [ ] 2.3 Backend: Attendance Check-in/Check-out endpoint
- [ ] 2.4 Frontend: Halaman Manajemen Anak (Admin)
- [ ] 2.5 Frontend: Halaman QR Generator (Admin)
- [ ] 2.6 Frontend: Halaman QR Scanner (Admin)
- [ ] 2.7 Frontend: Admin Dashboard overview

---

## 2.1 — Backend: Children CRUD

### `backend/schemas/child.py`
```python
from pydantic import BaseModel
from typing import Optional
from datetime import date

class ChildCreate(BaseModel):
    full_name: str
    birth_date: date
    gender: str          # 'male' | 'female'
    parent_id: Optional[str] = None
    notes: Optional[str] = None
    enrolled_at: Optional[date] = None

class ChildUpdate(BaseModel):
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    parent_id: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    photo_url: Optional[str] = None
```

### `backend/api/endpoints/children.py`
```python
from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user, require_role
from schemas.child import ChildCreate, ChildUpdate
from supabase import create_client
from core.config import settings
import qrcode, io, base64, uuid

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.get("/")
async def list_children(current_user = Depends(get_current_user)):
    """
    - Admin/Caregiver: semua anak aktif
    - Parent: hanya anak miliknya
    """
    if current_user["role"] == "parent":
        res = sb.table("children").select("*").eq("parent_id", current_user["id"]).execute()
    else:
        res = sb.table("children").select("*, users!parent_id(full_name, phone)").execute()
    return {"status": "success", "data": res.data}

@router.post("/", dependencies=[Depends(require_role("admin"))])
async def create_child(payload: ChildCreate, current_user = Depends(get_current_user)):
    """[Admin] Daftarkan anak baru"""
    child_id = str(uuid.uuid4())
    data = payload.model_dump()
    data["id"] = child_id
    data["birth_date"] = data["birth_date"].isoformat()
    if data.get("enrolled_at"):
        data["enrolled_at"] = data["enrolled_at"].isoformat()

    res = sb.table("children").insert(data).execute()
    return {"status": "success", "data": res.data[0]}

@router.put("/{child_id}", dependencies=[Depends(require_role("admin"))])
async def update_child(child_id: str, payload: ChildUpdate):
    """[Admin] Update data anak"""
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "birth_date" in data:
        data["birth_date"] = data["birth_date"].isoformat()
    res = sb.table("children").update(data).eq("id", child_id).execute()
    return {"status": "success", "data": res.data[0]}

@router.delete("/{child_id}", dependencies=[Depends(require_role("admin"))])
async def deactivate_child(child_id: str):
    """[Admin] Nonaktifkan anak (soft delete)"""
    res = sb.table("children").update({"is_active": False}).eq("id", child_id).execute()
    return {"status": "success", "message": "Anak dinonaktifkan"}
```

---

## 2.2 — Backend: QR Code Generator

### Tambahkan endpoint berikut di `children.py`

```python
@router.post("/{child_id}/generate-qr", dependencies=[Depends(require_role("admin"))])
async def generate_qr(child_id: str):
    """
    Generate QR Code untuk anak.
    QR Code berisi JSON string: {"child_id": "...", "token": "..."}
    Return: QR Code sebagai base64 PNG image
    """
    # Buat payload QR yang unik
    qr_payload = f'{{"child_id":"{child_id}","token":"{uuid.uuid4()}"}}'

    # Generate QR image
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#6C63FF", back_color="white")

    # Konversi ke base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()

    # Simpan ke database
    sb.table("children").update({"qr_code": qr_payload}).eq("id", child_id).execute()

    return {"status": "success", "data": {"qr_image": qr_base64, "qr_payload": qr_payload}}
```

---

## 2.3 — Backend: Attendance Check-in & Check-out

### `backend/schemas/attendance.py`
```python
from pydantic import BaseModel
from typing import Optional

class QRScanPayload(BaseModel):
    qr_data: str   # JSON string dari kamera QR scanner
    action: str    # 'checkin' | 'checkout'
```

### `backend/api/endpoints/attendances.py`
```python
import json
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from datetime import date, datetime, timezone
from api.deps import require_role, get_current_user
from schemas.attendance import QRScanPayload
from supabase import create_client
from core.config import settings

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.post("/scan", dependencies=[Depends(require_role("admin"))])
async def scan_qr(
    payload: QRScanPayload,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Proses scan QR untuk check-in atau check-out"""
    try:
        qr_data = json.loads(payload.qr_data)
        child_id = qr_data["child_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="QR Code tidak valid")

    today = date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # Cek apakah sudah ada record attendance hari ini
    existing = sb.table("attendances").select("*").eq("child_id", child_id).eq("date", today).execute()

    if payload.action == "checkin":
        if existing.data:
            raise HTTPException(status_code=409, detail="Anak sudah check-in hari ini")
        res = sb.table("attendances").insert({
            "child_id": child_id,
            "date": today,
            "check_in_at": now,
            "checked_in_by": current_user["id"],
            "status": "present"
        }).execute()
        # Ambil nama anak
        child = sb.table("children").select("full_name").eq("id", child_id).single().execute()
        return {"status":"success","message":f"{child.data['full_name']} berhasil check-in","data":res.data[0]}

    elif payload.action == "checkout":
        if not existing.data or existing.data[0].get("check_out_at"):
            raise HTTPException(status_code=400, detail="Anak belum check-in atau sudah checkout")

        res = sb.table("attendances").update({
            "check_out_at": now,
            "checked_out_by": current_user["id"]
        }).eq("id", existing.data[0]["id"]).execute()

        # Trigger AI Daily Summary (Feature C) di background
        from services.ai_service import generate_daily_summary
        background_tasks.add_task(generate_daily_summary, child_id, today)

        child = sb.table("children").select("full_name").eq("id", child_id).single().execute()
        return {"status":"success","message":f"{child.data['full_name']} berhasil check-out. Cerita harian sedang dibuat...","data":res.data[0]}

@router.get("/")
async def list_attendances(
    child_id: str = None,
    month: int = None,
    year: int = None,
    current_user = Depends(get_current_user)
):
    """Ambil daftar kehadiran. Filter opsional: child_id, month, year"""
    query = sb.table("attendances").select("*, children(full_name)")
    if child_id:
        query = query.eq("child_id", child_id)
    if month and year:
        query = query.gte("date", f"{year}-{month:02d}-01").lt("date", f"{year}-{month+1:02d}-01" if month < 12 else f"{year+1}-01-01")
    res = query.order("date", desc=True).execute()
    return {"status":"success","data":res.data}
```

---

## 2.4 — Frontend: Halaman Manajemen Anak

### `frontend/src/pages/admin/ChildrenManagement.jsx`
```jsx
import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'

export default function ChildrenManagement() {
  const [children, setChildren] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name:'', birth_date:'', gender:'male', notes:'' })

  const loadChildren = async () => {
    const res = await api.get('/api/v1/children')
    setChildren(res.data.data)
  }

  useEffect(() => { loadChildren() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await api.post('/api/v1/children', form)
    toast.success('Data anak berhasil ditambahkan')
    setShowForm(false)
    setForm({ full_name:'', birth_date:'', gender:'male', notes:'' })
    loadChildren()
  }

  const handleDeactivate = async (id) => {
    if (!confirm('Nonaktifkan anak ini?')) return
    await api.delete(`/api/v1/children/${id}`)
    toast.success('Anak dinonaktifkan')
    loadChildren()
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>👶 Manajemen Anak</h2>
        <button style={styles.btn} onClick={() => setShowForm(!showForm)}>+ Tambah Anak</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input style={styles.input} placeholder="Nama Lengkap Anak"
            value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})} required />
          <input style={styles.input} type="date" placeholder="Tanggal Lahir"
            value={form.birth_date} onChange={e => setForm({...form, birth_date:e.target.value})} required />
          <select style={styles.input} value={form.gender}
            onChange={e => setForm({...form, gender:e.target.value})}>
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
          </select>
          <textarea style={{...styles.input, resize:'none'}} rows={3} placeholder="Catatan khusus (opsional)"
            value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} />
          <button style={styles.btn} type="submit">Simpan</button>
        </form>
      )}

      <div style={styles.grid}>
        {children.map(child => (
          <div key={child.id} style={styles.card}>
            <div style={styles.avatar}>{child.gender === 'male' ? '👦' : '👧'}</div>
            <div>
              <div style={styles.name}>{child.full_name}</div>
              <div style={styles.meta}>{child.birth_date}</div>
              <span style={{...styles.badge, background: child.is_active ? 'var(--success)' : 'var(--danger)'}}>
                {child.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div style={styles.actions}>
              <a href={`/admin/qr-generator?child_id=${child.id}`} style={styles.actionBtn}>QR</a>
              <button style={{...styles.actionBtn, background:'var(--danger)'}}
                onClick={() => handleDeactivate(child.id)}>Nonaktifkan</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  page: { padding:'2rem' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' },
  title: { fontSize:'1.5rem', fontWeight:700 },
  btn: { background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-md)',
    padding:'0.6rem 1.2rem', fontWeight:600, cursor:'pointer' },
  form: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
    padding:'1.5rem', marginBottom:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' },
  input: { background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
    padding:'0.75rem 1rem', color:'var(--text)', fontSize:'0.9rem' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' },
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
    padding:'1.25rem', display:'flex', alignItems:'center', gap:'1rem' },
  avatar: { fontSize:'2.5rem' },
  name: { fontWeight:600, marginBottom:'0.25rem' },
  meta: { fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'0.5rem' },
  badge: { fontSize:'0.75rem', padding:'0.2rem 0.6rem', borderRadius:'999px', color:'#fff' },
  actions: { marginLeft:'auto', display:'flex', flexDirection:'column', gap:'0.5rem' },
  actionBtn: { background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)',
    padding:'0.4rem 0.75rem', fontSize:'0.8rem', cursor:'pointer', textDecoration:'none',
    textAlign:'center', display:'block' },
}
```

---

## 2.5 — Frontend: Halaman QR Generator

### `frontend/src/pages/admin/QRGenerator.jsx`
```jsx
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/axios'
import toast from 'react-hot-toast'

export default function QRGenerator() {
  const [searchParams] = useSearchParams()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(searchParams.get('child_id') || '')
  const [qrImage, setQrImage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/api/v1/children').then(r => setChildren(r.data.data))
  }, [])

  const generateQR = async () => {
    if (!selectedChild) { toast.error('Pilih anak terlebih dahulu'); return }
    setLoading(true)
    const res = await api.post(`/api/v1/children/${selectedChild}/generate-qr`)
    setQrImage(res.data.data.qr_image)
    setLoading(false)
    toast.success('QR Code berhasil dibuat!')
  }

  const printQR = () => window.print()

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>🔲 Generator QR Code Presensi</h2>
      <div style={styles.card}>
        <select style={styles.select} value={selectedChild}
          onChange={e => { setSelectedChild(e.target.value); setQrImage(null) }}>
          <option value="">-- Pilih Anak --</option>
          {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <button style={styles.btn} onClick={generateQR} disabled={loading}>
          {loading ? 'Membuat...' : 'Generate QR Code'}
        </button>
        {qrImage && (
          <div style={styles.qrBox}>
            <img src={qrImage} alt="QR Code" style={styles.qrImage} />
            <p style={styles.qrNote}>QR ini unik untuk: <strong>
              {children.find(c => c.id === selectedChild)?.full_name}
            </strong></p>
            <button style={styles.printBtn} onClick={printQR}>🖨️ Cetak QR</button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { padding:'2rem' },
  title: { fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' },
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'2rem', maxWidth:'480px' },
  select: { width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-md)', padding:'0.75rem 1rem', color:'var(--text)',
    fontSize:'0.9rem', marginBottom:'1rem' },
  btn: { width:'100%', background:'var(--primary)', color:'#fff', border:'none',
    borderRadius:'var(--radius-md)', padding:'0.8rem', fontWeight:600, cursor:'pointer', fontSize:'1rem' },
  qrBox: { marginTop:'1.5rem', textAlign:'center' },
  qrImage: { width:'220px', height:'220px', borderRadius:'var(--radius-md)',
    border:'4px solid var(--primary)', marginBottom:'1rem' },
  qrNote: { color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:'1rem' },
  printBtn: { background:'var(--accent)', color:'var(--bg)', border:'none',
    borderRadius:'var(--radius-md)', padding:'0.6rem 1.2rem', fontWeight:600, cursor:'pointer' },
}
```

---

## 2.6 — Frontend: Halaman QR Scanner

### `frontend/src/pages/admin/QRScanner.jsx`
```jsx
import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import api from '../../lib/axios'
import toast from 'react-hot-toast'

export default function QRScanner() {
  const scannerRef = useRef(null)
  const [action, setAction] = useState('checkin')
  const [lastResult, setLastResult] = useState(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false)
    scannerRef.current = scanner

    scanner.render(async (decodedText) => {
      scanner.clear()
      setScanning(false)
      try {
        const res = await api.post('/api/v1/attendances/scan', {
          qr_data: decodedText,
          action: action
        })
        setLastResult({ success: true, message: res.data.message })
        toast.success(res.data.message)
      } catch (err) {
        const msg = err.response?.data?.detail || 'Gagal memproses QR'
        setLastResult({ success: false, message: msg })
        toast.error(msg)
      }
    }, (err) => { /* ignore scan errors */ })

    setScanning(true)
    return () => { try { scanner.clear() } catch(e) {} }
  }, [action])

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>📷 Scan QR Presensi</h2>
      <div style={styles.tabs}>
        {['checkin','checkout'].map(a => (
          <button key={a} style={{...styles.tab, ...(action===a ? styles.tabActive : {})}}
            onClick={() => setAction(a)}>
            {a === 'checkin' ? '✅ Check-In' : '🚪 Check-Out'}
          </button>
        ))}
      </div>
      <div style={styles.scanBox}>
        <div id="qr-reader" style={{ width:'100%' }} />
      </div>
      {lastResult && (
        <div style={{...styles.result, background: lastResult.success ? 'rgba(67,217,173,0.15)' : 'rgba(255,101,132,0.15)',
          borderColor: lastResult.success ? 'var(--success)' : 'var(--danger)'}}>
          <span>{lastResult.success ? '✅' : '❌'}</span>
          <span>{lastResult.message}</span>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding:'2rem', maxWidth:'600px', margin:'0 auto' },
  title: { fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' },
  tabs: { display:'flex', gap:'0.75rem', marginBottom:'1.5rem' },
  tab: { flex:1, background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-md)', padding:'0.75rem', color:'var(--text-muted)',
    cursor:'pointer', fontWeight:500 },
  tabActive: { background:'var(--primary)', color:'#fff', borderColor:'var(--primary)' },
  scanBox: { background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'1.5rem', marginBottom:'1.5rem' },
  result: { border:'1px solid', borderRadius:'var(--radius-md)', padding:'1rem',
    display:'flex', gap:'0.75rem', alignItems:'center', fontSize:'0.95rem' },
}
```

---

## Verifikasi Modul-02

| Test | Expected |
|------|----------|
| Admin tambah anak baru | Data muncul di daftar anak |
| Admin generate QR untuk anak | QR Image base64 ditampilkan |
| Scan QR → Check-in | Record attendance dibuat, pesan sukses |
| Scan QR yang sama 2x Check-in | Error `409 - sudah check-in` |
| Scan QR → Check-out | `check_out_at` terisi, AI summary di-trigger di background |
| Checkout tanpa check-in | Error `400` |
