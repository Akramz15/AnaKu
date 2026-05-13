# MODUL-09 — Polish, Testing & Deployment Preparation

> **Fase:** 9 | **Estimasi:** 1–2 hari | **Prasyarat:** MODUL-00 s/d MODUL-08 selesai

---

## Tujuan Modul

Menyempurnakan aplikasi dari sisi UX (loading states, error handling, responsive), memverifikasi keamanan RLS Supabase, membuat data demo, dan menyiapkan build untuk deployment.

---

## Checklist Tugas

- [ ] 9.1 Global Error Handling (Frontend & Backend)
- [ ] 9.2 Loading States & Skeleton Loaders
- [ ] 9.3 Responsive Design (Mobile-first check)
- [ ] 9.4 RLS Policy Verification
- [ ] 9.5 Demo Data Seeding (SQL)
- [ ] 9.6 Admin Dashboard Overview (statistik)
- [ ] 9.7 PageLayout wrapping semua halaman
- [ ] 9.8 Production Build & Deployment Prep

---

## 9.1 — Global Error Handling

### Backend: Standardisasi Error Response

Tambahkan ke `backend/main.py`:
```python
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"status":"error","message":"Data tidak valid","detail": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status":"error","message":"Terjadi kesalahan server","detail": str(exc)}
    )
```

### Frontend: Global Axios Error Interceptor

Tambahkan ke `frontend/src/lib/axios.js`:
```js
import toast from 'react-hot-toast'

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail
              || error.response?.data?.message
              || 'Terjadi kesalahan. Silakan coba lagi.'

    // Jangan tampilkan toast untuk 401 (ditangani ProtectedRoute)
    if (error.response?.status !== 401) {
      toast.error(msg)
    }

    // Redirect ke login jika 401
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)
```

---

## 9.2 — Skeleton Loader & Loading States

### `frontend/src/components/ui/SkeletonLoader.jsx`
```jsx
export default function SkeletonLoader({ width = '100%', height = '20px', borderRadius = '8px', count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          width, height, borderRadius,
          background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          marginBottom: count > 1 ? '0.5rem' : '0',
        }} />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  )
}
```

### Cara Penggunaan di Komponen
```jsx
import SkeletonLoader from '../components/ui/SkeletonLoader'

// Contoh di ParentDashboard:
{loading ? (
  <SkeletonLoader height="120px" borderRadius="16px" count={4} />
) : (
  /* konten asli */
)}
```

---

## 9.3 — Responsive Design Checklist

Tambahkan CSS media queries ke `frontend/src/index.css`:
```css
/* Layout utama: sidebar collapse di mobile */
@media (max-width: 768px) {
  /* Sidebar menjadi bottom navigation */
  aside {
    width: 100% !important;
    min-height: auto !important;
    flex-direction: row !important;
    padding: 0.5rem !important;
    border-right: none !important;
    border-top: 1px solid var(--border) !important;
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 100 !important;
    overflow-x: auto !important;
  }

  /* Grid adaptif */
  .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .quick-grid { grid-template-columns: repeat(2, 1fr) !important; }

  /* Tambahkan padding bottom agar konten tidak tertutup bottom nav */
  main { padding-bottom: 80px !important; }

  /* Chat: full width di mobile */
  .chat-sidebar { display: none; }
  .chat-area { width: 100% !important; }
}

@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr !important; }
  .two-col { flex-direction: column !important; }
}
```

**Cara implementasi:** Tambahkan `className` yang sesuai (`stats-grid`, `quick-grid`, `two-col`) pada div-div yang relevan di halaman.

---

## 9.4 — RLS Policy Verification

Jalankan query berikut di **Supabase SQL Editor** untuk memverifikasi keamanan:

```sql
-- ── TEST 1: Parent hanya lihat anaknya ──────────────────────────────
-- Ganti 'UUID_PARENT_A' dengan UUID user parent yang sedang ditest
SET LOCAL "request.jwt.claims" TO '{"sub":"UUID_PARENT_A","role":"authenticated"}';

SELECT * FROM public.children;
-- Expected: hanya baris dengan parent_id = UUID_PARENT_A

SELECT * FROM public.daily_logs;
-- Expected: hanya log anak milik parent tersebut

SELECT * FROM public.billings;
-- Expected: hanya tagihan anak milik parent tersebut

-- ── TEST 2: Caregiver tidak bisa lihat billing ───────────────────────
SET LOCAL "request.jwt.claims" TO '{"sub":"UUID_CAREGIVER","role":"authenticated"}';
SELECT * FROM public.billings;
-- Expected: kosong (RLS harus mencegah akses)

-- ── TEST 3: Caregiver bisa INSERT daily_log ──────────────────────────
-- Jalankan INSERT dummy → harusnya berhasil
INSERT INTO public.daily_logs(child_id, log_date, mood)
VALUES ('UUID_CHILD', CURRENT_DATE, 'ceria');
-- Expected: berhasil

-- ── TEST 4: Parent tidak bisa INSERT daily_log ───────────────────────
SET LOCAL "request.jwt.claims" TO '{"sub":"UUID_PARENT_A","role":"authenticated"}';
INSERT INTO public.daily_logs(child_id, log_date, mood)
VALUES ('UUID_CHILD', CURRENT_DATE, 'ceria');
-- Expected: ERROR - new row violates row-level security policy
```

**Kebijakan RLS yang perlu ditambahkan (jika belum lengkap):**
```sql
-- Billings: parent hanya lihat anaknya, admin full access
CREATE POLICY "billings_parent_select" ON public.billings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "billings_admin_all" ON public.billings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Galleries: parent lihat anaknya, caregiver INSERT, admin semua
CREATE POLICY "galleries_parent_select" ON public.galleries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('caregiver','admin'))
  );

CREATE POLICY "galleries_caregiver_insert" ON public.galleries FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('caregiver','admin')));

-- Attendances: admin INSERT, semua bisa SELECT yang relevan
CREATE POLICY "attendances_admin_insert" ON public.attendances FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "attendances_read" ON public.attendances FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('caregiver','admin'))
  );
```

---

## 9.5 — Demo Data Seeding

Jalankan di Supabase SQL Editor setelah mendaftarkan akun demo via `/register`:

```sql
-- Asumsi: sudah ada 3 user terdaftar (parent, caregiver, admin)
-- Ganti UUID-PARENT, UUID-CAREGIVER, UUID-ADMIN dengan UUID asli dari auth.users

-- Tambahkan data anak demo
INSERT INTO public.children (id, full_name, birth_date, gender, parent_id, is_active, enrolled_at, notes) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Aisyah Putri', '2021-03-15', 'female', 'UUID-PARENT', true, '2024-01-08', 'Alergi susu sapi'),
  ('11111111-0000-0000-0000-000000000002', 'Rizky Pratama', '2020-07-22', 'male',   'UUID-PARENT', true, '2024-01-08', NULL);

-- QR Code untuk kedua anak
UPDATE public.children SET qr_code = '{"child_id":"11111111-0000-0000-0000-000000000001","token":"demo-token-001"}'
  WHERE id = '11111111-0000-0000-0000-000000000001';
UPDATE public.children SET qr_code = '{"child_id":"11111111-0000-0000-0000-000000000002","token":"demo-token-002"}'
  WHERE id = '11111111-0000-0000-0000-000000000002';

-- Data kehadiran 7 hari terakhir
INSERT INTO public.attendances (child_id, date, check_in_at, check_out_at, status) VALUES
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 6, NOW() - INTERVAL '6 days 5 hours', NOW() - INTERVAL '6 days', 'present'),
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 5, NOW() - INTERVAL '5 days 5 hours', NOW() - INTERVAL '5 days', 'present'),
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 4, NOW() - INTERVAL '4 days 5 hours', NOW() - INTERVAL '4 days', 'present'),
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 3, NULL, NULL, 'sick'),
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 2, NOW() - INTERVAL '2 days 5 hours', NOW() - INTERVAL '2 days', 'present'),
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 1, NOW() - INTERVAL '1 day 5 hours',  NOW() - INTERVAL '1 day',  'present'),
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE,     NOW() - INTERVAL '5 hours',         NULL,                     'present');

-- Daily logs dengan sentimen demo
INSERT INTO public.daily_logs (child_id, caregiver_id, log_date, meal_morning, meal_lunch, meal_snack, sleep_duration_min, sleep_quality, mood, activities, special_notes, sentiment_label, sentiment_score, ai_daily_summary) VALUES
  ('11111111-0000-0000-0000-000000000001', 'UUID-CAREGIVER', CURRENT_DATE - 6, 'habis', 'habis', 'setengah', 90, 'nyenyak', 'ceria',    ARRAY['Mewarnai','Bernyanyi'], 'Aisyah sangat antusias hari ini', 'positif', 0.92, 'Hari yang menyenangkan untuk Aisyah Putri...'),
  ('11111111-0000-0000-0000-000000000001', 'UUID-CAREGIVER', CURRENT_DATE - 5, 'habis', 'setengah', 'habis', 75, 'nyenyak', 'biasa',   ARRAY['Bermain Balok'],        'Aisyah baik-baik saja',           'netral',  0.60, 'Aisyah hari ini bermain dengan tenang...'),
  ('11111111-0000-0000-0000-000000000001', 'UUID-CAREGIVER', CURRENT_DATE - 4, 'setengah', 'habis', 'habis', 60, 'gelisah', 'ceria',   ARRAY['Menggambar'],           'Aisyah sedikit lelah tapi ceria', 'positif', 0.78, 'Meski sedikit mengantuk, semangat Aisyah...'),
  ('11111111-0000-0000-0000-000000000001', 'UUID-CAREGIVER', CURRENT_DATE - 2, 'tidak_makan', 'setengah', 'tidak_makan', 45, 'gelisah', 'rewel', ARRAY['Bermain Air'], 'Aisyah rewel dan tidak mau makan', 'negatif', 0.85, 'Hari ini Aisyah tampak kurang bersemangat...'),
  ('11111111-0000-0000-0000-000000000001', 'UUID-CAREGIVER', CURRENT_DATE - 1, 'habis', 'habis', 'habis', 90, 'nyenyak', 'ceria',     ARRAY['Bernyanyi','Mewarnai'], 'Sudah kembali ceria!',             'positif', 0.95, 'Aisyah sudah pulih dan sangat bersemangat...');

-- Tagihan demo
INSERT INTO public.billings (child_id, period_month, period_year, base_fee, attendance_days, total_amount, status, due_date) VALUES
  ('11111111-0000-0000-0000-000000000001', EXTRACT(MONTH FROM CURRENT_DATE)::int - 1, EXTRACT(YEAR FROM CURRENT_DATE)::int, 500000, 20, 500000, 'paid',   CURRENT_DATE - 10),
  ('11111111-0000-0000-0000-000000000001', EXTRACT(MONTH FROM CURRENT_DATE)::int,     EXTRACT(YEAR FROM CURRENT_DATE)::int, 500000, 5,  500000, 'unpaid', CURRENT_DATE + 20);
```

---

## 9.6 — Admin Dashboard Overview

### `frontend/src/pages/admin/AdminDashboard.jsx`
```jsx
import { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import api from '../../lib/axios'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total:0, active:0, today:0, unpaid:0 })
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/children'),
      api.get('/api/v1/attendances'),
      api.get('/api/v1/billings'),
    ]).then(([c, a, b]) => {
      const today = new Date().toISOString().split('T')[0]
      setStats({
        total:  c.data.data.length,
        active: c.data.data.filter(x => x.is_active).length,
        today:  a.data.data.filter(x => x.date === today && x.status === 'present').length,
        unpaid: b.data.data.filter(x => x.status === 'unpaid').length,
      })
    })
  }, [])

  const CARDS = [
    { label:'Total Anak Terdaftar', value: stats.total,  icon:'👶', color:'var(--primary)',   path:'/admin/children' },
    { label:'Hadir Hari Ini',        value: stats.today,  icon:'✅', color:'var(--success)',   path:'/admin/qr-scanner' },
    { label:'Tagihan Belum Bayar',   value: stats.unpaid, icon:'💰', color:'var(--warning)',   path:'/admin/billing' },
    { label:'Scan Presensi',         value:'Buka',        icon:'📷', color:'var(--secondary)', path:'/admin/qr-scanner' },
  ]

  return (
    <PageLayout>
      <div style={{ padding:'2rem' }}>
        <h1 style={{ fontSize:'1.5rem', fontWeight:800, marginBottom:'1.5rem' }}>
          ⚙️ Admin Dashboard
        </h1>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem' }}>
          {CARDS.map(card => (
            <div key={card.label} style={{ background:'var(--surface)', border:`1px solid ${card.color}40`,
              borderRadius:'var(--radius-lg)', padding:'1.5rem', cursor:'pointer',
              borderLeft:`4px solid ${card.color}` }}
              onClick={() => navigate(card.path)}>
              <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>{card.icon}</div>
              <div style={{ fontSize:'2rem', fontWeight:800, color: card.color }}>{card.value}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem' }}>{card.label}</div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
```

---

## 9.7 — Wrap Semua Halaman dengan PageLayout

Pastikan **semua halaman yang sudah ada** (kecuali Login & Register) sudah di-wrap dengan `<PageLayout>`:

```jsx
// Contoh pola yang benar:
import PageLayout from '../../components/layout/PageLayout'

export default function HalamanApaSaja() {
  return (
    <PageLayout>
      <div style={{ padding:'2rem' }}>
        {/* konten halaman */}
      </div>
    </PageLayout>
  )
}
```

Halaman yang perlu di-check:
- `ParentDashboard` ✅ (sudah di MODUL-08)
- `AIChatbot` — tambahkan PageLayout wrapper
- `ParentGallery` — tambahkan PageLayout wrapper
- `ParentBilling` — tambahkan PageLayout wrapper
- `ParentChat` — tambahkan PageLayout wrapper
- `CaregiverDashboard` ✅ (sudah di MODUL-08)
- `DailyLogForm` — tambahkan PageLayout wrapper
- `GalleryUpload` — tambahkan PageLayout wrapper
- `CaregiverChat` — tambahkan PageLayout wrapper
- `AdminDashboard` ✅ (sudah di MODUL-09)
- `ChildrenManagement` — tambahkan PageLayout wrapper
- `QRGenerator` — tambahkan PageLayout wrapper
- `QRScanner` — tambahkan PageLayout wrapper
- `BillingManagement` — tambahkan PageLayout wrapper

---

## 9.8 — Production Build & Deployment

### Build Frontend
```bash
cd frontend
npm run build
# Output: folder dist/
```

### Jalankan Backend dengan Gunicorn (Production)
```bash
cd backend
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### `.env.example` (Dokumentasi untuk tim/juri)
```env
# Frontend
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=https://your-backend-url.com

# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-api-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Opsi Deployment Platform

| Service | Frontend | Backend | Notes |
|---------|----------|---------|-------|
| **Vercel** | ✅ Gratis | ❌ | Deploy `frontend/dist/` |
| **Railway** | ❌ | ✅ Gratis $5 credit | Deploy FastAPI |
| **Render** | ✅ Gratis | ✅ Gratis (sleep 15 min) | Full stack |
| **Netlify** | ✅ Gratis | ❌ | Deploy `frontend/dist/` |

**Rekomendasi:** Vercel (frontend) + Railway (backend)

---

## Verifikasi Akhir Modul-09

| Test | Expected |
|------|----------|
| `npm run build` frontend | Tidak ada error, folder `dist/` terbuat |
| Error 404 API → toast muncul | Toast error tampil, tidak crash |
| Error 401 → redirect login | Halaman pindah ke `/login` |
| Skeleton loader saat fetch | Animasi shimmer tampil sebelum data |
| Mobile 375px | Layout tidak overflow, navigasi bisa diakses |
| RLS test parent A lihat data parent B | Tidak bisa (kosong/error) |
| Seed data terpasang | Aisyah & Rizky muncul di manajemen anak |
| Admin dashboard | 4 kartu statistik tampil dengan angka |
