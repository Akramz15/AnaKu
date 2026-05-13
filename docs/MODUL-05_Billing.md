# MODUL-05 — Tagihan & Riwayat Pembayaran

> **Fase:** 5 | **Estimasi:** 1 hari | **Prasyarat:** MODUL-01, MODUL-02

---

## Tujuan Modul

Admin dapat generate tagihan bulanan per anak (otomatis menghitung hari hadir dari tabel `attendances`). Parent dapat melihat tagihan aktif dan riwayat pembayaran. Admin menandai tagihan lunas.

---

## Checklist Tugas

- [ ] 5.1 Backend: Billing schema & endpoints
- [ ] 5.2 Frontend: Halaman Manajemen Tagihan (Admin)
- [ ] 5.3 Frontend: Halaman Tagihan (Parent)

---

## 5.1 — Backend: Billing Schema & Endpoints

### `backend/schemas/billing.py`
```python
from pydantic import BaseModel
from typing import Optional
from datetime import date

class BillingCreate(BaseModel):
    child_id: str
    period_month: int       # 1-12
    period_year: int
    base_fee: float         # Tarif dasar per bulan
    due_date: Optional[date] = None
    notes: Optional[str] = None

class BillingStatusUpdate(BaseModel):
    status: str             # 'paid' | 'unpaid' | 'overdue'
```

### `backend/api/endpoints/billings.py`
```python
from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user, require_role
from schemas.billing import BillingCreate, BillingStatusUpdate
from supabase import create_client
from core.config import settings
from datetime import datetime, timezone

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.post("/", dependencies=[Depends(require_role("admin"))])
async def create_billing(payload: BillingCreate):
    """
    [Admin] Generate tagihan bulanan untuk satu anak.
    Otomatis hitung hari hadir dari tabel attendances.
    """
    # Cek apakah sudah ada tagihan bulan ini
    existing = sb.table("billings").select("id") \
        .eq("child_id", payload.child_id) \
        .eq("period_month", payload.period_month) \
        .eq("period_year", payload.period_year).execute()
    if existing.data:
        raise HTTPException(409, "Tagihan bulan ini sudah ada untuk anak tersebut")

    # Hitung hari kehadiran dari tabel attendances
    m = payload.period_month
    y = payload.period_year
    next_m = 1 if m == 12 else m + 1
    next_y = y + 1 if m == 12 else y
    date_start = f"{y}-{m:02d}-01"
    date_end   = f"{next_y}-{next_m:02d}-01"

    att_res = sb.table("attendances").select("id") \
        .eq("child_id", payload.child_id) \
        .eq("status", "present") \
        .gte("date", date_start) \
        .lt("date", date_end).execute()
    attendance_days = len(att_res.data)

    # Total = base_fee (billing sederhana, bisa dikembangkan per-hari)
    total = payload.base_fee

    data = {
        "child_id": payload.child_id,
        "period_month": payload.period_month,
        "period_year": payload.period_year,
        "base_fee": payload.base_fee,
        "attendance_days": attendance_days,
        "total_amount": total,
        "due_date": payload.due_date.isoformat() if payload.due_date else None,
        "notes": payload.notes,
        "status": "unpaid",
    }
    res = sb.table("billings").insert(data).execute()
    return {"status": "success", "data": res.data[0]}

@router.get("/")
async def list_billings(
    child_id: str = None,
    current_user = Depends(get_current_user)
):
    """
    Admin: semua tagihan (filter opsional child_id).
    Parent: tagihan anak miliknya.
    """
    query = sb.table("billings").select("*, children(full_name, users!parent_id(full_name))")
    if current_user["role"] == "parent":
        kids = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        ids = [k["id"] for k in kids.data]
        if ids:
            query = query.in_("child_id", ids)
    elif child_id:
        query = query.eq("child_id", child_id)

    res = query.order("period_year", desc=True).order("period_month", desc=True).execute()
    return {"status": "success", "data": res.data}

@router.patch("/{billing_id}", dependencies=[Depends(require_role("admin"))])
async def update_billing_status(billing_id: str, payload: BillingStatusUpdate):
    """[Admin] Update status tagihan (tandai lunas/terlambat)"""
    data = {"status": payload.status}
    if payload.status == "paid":
        data["paid_at"] = datetime.now(timezone.utc).isoformat()
    res = sb.table("billings").update(data).eq("id", billing_id).execute()
    return {"status": "success", "data": res.data[0]}

@router.delete("/{billing_id}", dependencies=[Depends(require_role("admin"))])
async def delete_billing(billing_id: str):
    """[Admin] Hapus tagihan"""
    sb.table("billings").delete().eq("id", billing_id).execute()
    return {"status": "success", "message": "Tagihan dihapus"}
```

---

## 5.2 — Frontend: Manajemen Tagihan (Admin)

### `frontend/src/pages/admin/BillingManagement.jsx`
```jsx
import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'

const STATUS_COLOR = { paid:'var(--success)', unpaid:'var(--warning)', overdue:'var(--danger)' }
const STATUS_LABEL = { paid:'✅ Lunas', unpaid:'⏳ Belum Bayar', overdue:'🔴 Terlambat' }
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

export default function BillingManagement() {
  const [billings, setBillings] = useState([])
  const [children, setChildren] = useState([])
  const [form, setForm] = useState({
    child_id:'', period_month: new Date().getMonth()+1,
    period_year: new Date().getFullYear(), base_fee: 500000, due_date:''
  })
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    const [b, c] = await Promise.all([
      api.get('/api/v1/billings'),
      api.get('/api/v1/children'),
    ])
    setBillings(b.data.data)
    setChildren(c.data.data)
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/v1/billings', form)
      toast.success('Tagihan berhasil dibuat!')
      setShowForm(false)
      load()
    } catch(e) {
      toast.error(e.response?.data?.detail || 'Gagal membuat tagihan')
    }
  }

  const markPaid = async (id) => {
    await api.patch(`/api/v1/billings/${id}`, { status:'paid' })
    toast.success('Tagihan ditandai lunas')
    load()
  }

  const markOverdue = async (id) => {
    await api.patch(`/api/v1/billings/${id}`, { status:'overdue' })
    load()
  }

  const formatRp = (num) => `Rp ${Number(num).toLocaleString('id-ID')}`

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>💰 Manajemen Tagihan</h2>
        <button style={styles.btn} onClick={() => setShowForm(!showForm)}>+ Generate Tagihan</button>
      </div>

      {showForm && (
        <form onSubmit={handleGenerate} style={styles.form}>
          <select style={styles.input} value={form.child_id}
            onChange={e => setForm(f=>({...f, child_id:e.target.value}))} required>
            <option value="">-- Pilih Anak --</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <select style={styles.input} value={form.period_month}
              onChange={e => setForm(f=>({...f, period_month:Number(e.target.value)}))}>
              {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <input style={styles.input} type="number" placeholder="Tahun"
              value={form.period_year}
              onChange={e => setForm(f=>({...f, period_year:Number(e.target.value)}))} />
          </div>
          <input style={styles.input} type="number" placeholder="Biaya Dasar (Rp)"
            value={form.base_fee}
            onChange={e => setForm(f=>({...f, base_fee:Number(e.target.value)}))} />
          <input style={styles.input} type="date" placeholder="Jatuh Tempo"
            value={form.due_date}
            onChange={e => setForm(f=>({...f, due_date:e.target.value}))} />
          <button style={styles.btn} type="submit">Generate</button>
        </form>
      )}

      {/* Tabel Tagihan */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Anak','Periode','Hadir','Total','Jatuh Tempo','Status','Aksi'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {billings.map(b => (
              <tr key={b.id} style={styles.tr}>
                <td style={styles.td}>{b.children?.full_name}</td>
                <td style={styles.td}>{MONTHS[b.period_month-1]} {b.period_year}</td>
                <td style={styles.td}>{b.attendance_days} hari</td>
                <td style={styles.td}>{formatRp(b.total_amount)}</td>
                <td style={styles.td}>{b.due_date || '-'}</td>
                <td style={styles.td}>
                  <span style={{...styles.badge, background: STATUS_COLOR[b.status]}}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </td>
                <td style={styles.td}>
                  {b.status !== 'paid' && (
                    <button style={styles.actionBtn} onClick={() => markPaid(b.id)}>Lunas</button>
                  )}
                  {b.status === 'unpaid' && (
                    <button style={{...styles.actionBtn, background:'var(--danger)'}}
                      onClick={() => markOverdue(b.id)}>Terlambat</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  page:      { padding:'2rem' },
  header:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' },
  title:     { fontSize:'1.5rem', fontWeight:700 },
  btn:       { background:'var(--primary)', color:'#fff', border:'none',
               borderRadius:'var(--radius-md)', padding:'0.6rem 1.2rem', fontWeight:600, cursor:'pointer' },
  form:      { background:'var(--surface)', border:'1px solid var(--border)',
               borderRadius:'var(--radius-md)', padding:'1.5rem', marginBottom:'1.5rem',
               display:'flex', flexDirection:'column', gap:'0.75rem', maxWidth:'500px' },
  input:     { background:'var(--surface-2)', border:'1px solid var(--border)',
               borderRadius:'var(--radius-sm)', padding:'0.75rem', color:'var(--text)', flex:1 },
  tableWrap: { overflowX:'auto' },
  table:     { width:'100%', borderCollapse:'collapse' },
  th:        { background:'var(--surface-2)', padding:'0.75rem 1rem', textAlign:'left',
               fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:600 },
  tr:        { borderBottom:'1px solid var(--border)' },
  td:        { padding:'0.85rem 1rem', fontSize:'0.9rem' },
  badge:     { padding:'0.2rem 0.7rem', borderRadius:'999px', fontSize:'0.78rem', color:'#0F0F1A', fontWeight:600 },
  actionBtn: { background:'var(--success)', color:'#0F0F1A', border:'none',
               borderRadius:'var(--radius-sm)', padding:'0.35rem 0.75rem',
               fontSize:'0.8rem', cursor:'pointer', marginRight:'0.4rem', fontWeight:600 },
}
```

---

## 5.3 — Frontend: Tagihan Parent

### `frontend/src/pages/parent/Billing.jsx`
```jsx
import { useEffect, useState } from 'react'
import api from '../../lib/axios'

const STATUS_COLOR = { paid:'var(--success)', unpaid:'var(--warning)', overdue:'var(--danger)' }
const STATUS_LABEL = { paid:'✅ Lunas', unpaid:'⏳ Belum Bayar', overdue:'🔴 Terlambat' }
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

export default function ParentBilling() {
  const [billings, setBillings] = useState([])

  useEffect(() => {
    api.get('/api/v1/billings').then(r => setBillings(r.data.data))
  }, [])

  const formatRp = (num) => `Rp ${Number(num).toLocaleString('id-ID')}`
  const current = billings.find(b => b.status !== 'paid')
  const history = billings.filter(b => b.status === 'paid')

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>💰 Tagihan & Pembayaran</h2>

      {/* Tagihan Aktif */}
      {current && (
        <div style={styles.activeCard}>
          <div style={styles.activeLabel}>Tagihan Aktif</div>
          <div style={styles.activeName}>{current.children?.full_name}</div>
          <div style={styles.activePeriod}>{MONTHS[current.period_month-1]} {current.period_year}</div>
          <div style={styles.activeAmount}>{formatRp(current.total_amount)}</div>
          <div style={styles.activeMeta}>
            Hari Hadir: <strong>{current.attendance_days} hari</strong> &nbsp;|&nbsp;
            Jatuh Tempo: <strong>{current.due_date || 'Belum ditentukan'}</strong>
          </div>
          <span style={{...styles.badge, background: STATUS_COLOR[current.status]}}>
            {STATUS_LABEL[current.status]}
          </span>
          {current.notes && <p style={styles.notes}>📌 {current.notes}</p>}
        </div>
      )}

      {/* Riwayat */}
      <h3 style={{marginBottom:'1rem', marginTop:'2rem'}}>📜 Riwayat Pembayaran</h3>
      {history.length === 0
        ? <p style={styles.empty}>Belum ada riwayat pembayaran.</p>
        : history.map(b => (
          <div key={b.id} style={styles.historyCard}>
            <div>
              <div style={styles.histPeriod}>{MONTHS[b.period_month-1]} {b.period_year}</div>
              <div style={styles.histAmount}>{formatRp(b.total_amount)}</div>
              <div style={styles.histMeta}>Dibayar: {b.paid_at ? new Date(b.paid_at).toLocaleDateString('id-ID') : '-'}</div>
            </div>
            <span style={{...styles.badge, background: STATUS_COLOR[b.status]}}>
              {STATUS_LABEL[b.status]}
            </span>
          </div>
        ))
      }
    </div>
  )
}

const styles = {
  page:        { padding:'2rem', maxWidth:'600px' },
  title:       { fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' },
  activeCard:  { background:'linear-gradient(135deg, #1A1A2E, #22223B)',
                 border:'1px solid var(--primary)', borderRadius:'var(--radius-lg)',
                 padding:'1.75rem', marginBottom:'1rem', boxShadow:'var(--shadow-lg)' },
  activeLabel: { fontSize:'0.8rem', color:'var(--primary)', fontWeight:700,
                 textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.5rem' },
  activeName:  { fontSize:'1.1rem', fontWeight:700 },
  activePeriod:{ color:'var(--text-muted)', fontSize:'0.9rem', margin:'0.25rem 0' },
  activeAmount:{ fontSize:'2rem', fontWeight:800, color:'var(--primary)', margin:'0.75rem 0' },
  activeMeta:  { fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1rem' },
  badge:       { padding:'0.3rem 0.8rem', borderRadius:'999px', fontSize:'0.8rem',
                 color:'#0F0F1A', fontWeight:700, display:'inline-block' },
  notes:       { marginTop:'0.75rem', color:'var(--text-muted)', fontSize:'0.85rem' },
  historyCard: { background:'var(--surface)', border:'1px solid var(--border)',
                 borderRadius:'var(--radius-md)', padding:'1rem 1.25rem',
                 display:'flex', justifyContent:'space-between', alignItems:'center',
                 marginBottom:'0.75rem' },
  histPeriod:  { fontWeight:600, marginBottom:'0.2rem' },
  histAmount:  { color:'var(--text-muted)', fontSize:'0.9rem' },
  histMeta:    { fontSize:'0.8rem', color:'var(--text-muted)' },
  empty:       { color:'var(--text-muted)', fontStyle:'italic' },
}
```

---

## Verifikasi Modul-05

| Test | Expected |
|------|----------|
| Admin generate tagihan bulan ini | Record muncul di tabel billings, attendance_days terisi |
| Generate tagihan bulan yang sama 2x | Error 409 |
| Admin klik "Lunas" | Status berubah ke `paid`, `paid_at` terisi |
| Parent buka `/parent/billing` | Hanya melihat tagihan anaknya sendiri |
| Tagihan lunas tampil di riwayat | History section terisi |
