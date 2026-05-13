# MODUL-00 — Project Initialization & Infrastructure

> **Fase:** 0 | **Estimasi:** 1–2 hari | **Prasyarat:** Tidak ada

---

## Tujuan Modul

Menyiapkan seluruh fondasi proyek: scaffold frontend & backend, konfigurasi environment, migrasi database schema, dan design system dasar.

---

## Checklist Tugas

- [ ] 0.1 Scaffold Frontend (React + Vite)
- [ ] 0.2 Scaffold Backend (FastAPI + Python)
- [ ] 0.3 Konfigurasi Environment Variables (.env)
- [ ] 0.4 Migrasi Database Schema ke Supabase (DDL)
- [ ] 0.5 Konfigurasi Cloudinary Account
- [ ] 0.6 Design System & Global CSS

---

## 0.1 — Scaffold Frontend

### Perintah Terminal
```bash
# Dari folder AnaKuu/
npx create-vite@latest frontend --template react
cd frontend
npm install react-router-dom axios @supabase/supabase-js recharts html5-qrcode react-hot-toast lucide-react
```

### Struktur Folder `src/` yang Dibuat Manual
```
src/
├── assets/
├── components/
│   ├── ui/          # Button, Card, Input, Badge, Modal, Spinner, SkeletonLoader
│   ├── layout/      # Sidebar, Navbar, PageLayout
│   └── charts/      # EmotionTrendChart
├── context/         # AuthContext.jsx
├── hooks/           # useAuth.js, useChildren.js
├── lib/             # supabase.js, axios.js
├── pages/
│   ├── auth/        # Login.jsx, Register.jsx
│   ├── parent/      # ParentDashboard, AIChatbot, Gallery, Billing, ParentChat
│   ├── caregiver/   # CaregiverDashboard, DailyLogForm, GalleryUpload, CaregiverChat
│   └── admin/       # AdminDashboard, ChildrenManagement, QRGenerator, QRScanner, BillingManagement
└── routes/          # ProtectedRoute.jsx
```

---

## 0.2 — Scaffold Backend

### Perintah Terminal
```bash
# Dari folder AnaKuu/
mkdir backend && cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn supabase python-dotenv google-generativeai cloudinary python-multipart pydantic-settings pyjwt httpx qrcode pillow
pip freeze > requirements.txt
```

### Struktur Folder Backend
```
backend/
├── api/
│   ├── deps.py            # JWT middleware
│   └── endpoints/         # users, children, daily_logs, attendances, galleries, billings, chats, ai
├── core/
│   ├── config.py          # Settings (Pydantic BaseSettings)
│   ├── security.py        # JWT decode helper
│   └── gemini.py          # Gemini client + prompt templates
├── schemas/               # Pydantic request/response models per entity
├── services/
│   ├── cloudinary_service.py
│   └── ai_service.py
└── main.py
```

### `main.py` (Lengkap)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.endpoints import users, children, daily_logs, attendances, galleries, billings, chats, ai

app = FastAPI(title="AnaKu API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router,      prefix="/api/v1/users",        tags=["Users"])
app.include_router(children.router,   prefix="/api/v1/children",     tags=["Children"])
app.include_router(daily_logs.router, prefix="/api/v1/daily-logs",   tags=["Daily Logs"])
app.include_router(attendances.router,prefix="/api/v1/attendances",  tags=["Attendances"])
app.include_router(galleries.router,  prefix="/api/v1/galleries",    tags=["Galleries"])
app.include_router(billings.router,   prefix="/api/v1/billings",     tags=["Billings"])
app.include_router(chats.router,      prefix="/api/v1/chats",        tags=["Chats"])
app.include_router(ai.router,         prefix="/api/v1/ai",           tags=["AI"])

@app.get("/")
def root():
    return {"message": "AnaKu API is running 🚀"}
```

---

## 0.3 — Environment Variables

### `frontend/.env`
```env
VITE_SUPABASE_URL=https://XXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:8000
```

### `backend/.env`
```env
SUPABASE_URL=https://XXXX.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=AIzaSy...
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=123456
CLOUDINARY_API_SECRET=secret
```

### `backend/core/config.py`
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str
    GEMINI_API_KEY: str
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    class Config:
        env_file = ".env"

settings = Settings()
```

### `frontend/src/lib/supabase.js`
```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### `frontend/src/lib/axios.js`
```js
import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL })

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export default api
```

---

## 0.4 — DDL Database Supabase

Buka Supabase Dashboard → SQL Editor → paste & jalankan berurutan:

```sql
-- TABLE: users
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent','caregiver','admin')),
  phone TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user profile saat register
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users(id, full_name, role) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name','Pengguna Baru'),
    COALESCE(NEW.raw_user_meta_data->>'role','parent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- TABLE: children
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL, birth_date DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male','female')),
  photo_url TEXT, parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  qr_code TEXT UNIQUE, is_active BOOLEAN DEFAULT TRUE,
  enrolled_at DATE DEFAULT CURRENT_DATE, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: attendances
CREATE TABLE public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_at TIMESTAMPTZ, check_out_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.users(id),
  checked_out_by UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'present' CHECK (status IN ('present','absent','sick','permit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, date)
);

-- TABLE: daily_logs
CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES public.users(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_morning TEXT CHECK (meal_morning IN ('habis','setengah','tidak_makan')),
  meal_lunch TEXT CHECK (meal_lunch IN ('habis','setengah','tidak_makan')),
  meal_snack TEXT CHECK (meal_snack IN ('habis','setengah','tidak_makan')),
  sleep_duration_min INTEGER, sleep_quality TEXT CHECK (sleep_quality IN ('nyenyak','gelisah','tidak_tidur')),
  mood TEXT CHECK (mood IN ('ceria','biasa','rewel','menangis')),
  activities TEXT[], special_notes TEXT, toilet_count INTEGER DEFAULT 0, health_notes TEXT,
  sentiment_label TEXT CHECK (sentiment_label IN ('positif','netral','negatif')),
  sentiment_score FLOAT, ai_daily_summary TEXT, summary_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(child_id, log_date)
);

-- TABLE: galleries
CREATE TABLE public.galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES public.users(id),
  cloudinary_url TEXT NOT NULL, public_id TEXT,
  media_type TEXT DEFAULT 'photo' CHECK (media_type IN ('photo','video')),
  caption TEXT, activity_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: billings
CREATE TABLE public.billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL, base_fee NUMERIC(12,2) NOT NULL,
  attendance_days INTEGER DEFAULT 0, total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue')),
  due_date DATE, paid_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(child_id, period_month, period_year)
);

-- TABLE: chats_human
CREATE TABLE public.chats_human (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL,
  sender_id UUID REFERENCES public.users(id), receiver_id UUID REFERENCES public.users(id),
  message TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: chats_ai
CREATE TABLE public.chats_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','model')), message TEXT NOT NULL,
  context_log_id UUID REFERENCES public.daily_logs(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats_human ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats_ai ENABLE ROW LEVEL SECURITY;
```

---

## 0.5 — Konfigurasi Cloudinary

1. Login ke [cloudinary.com](https://cloudinary.com)
2. Dashboard → catat `Cloud Name`, `API Key`, `API Secret`
3. Settings → Upload Presets → Add preset bernama `anaku_gallery` (mode: **Unsigned**)
4. Masukkan ke `backend/.env`

---

## 0.6 — Global CSS Design System

### `frontend/src/index.css`
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
:root {
  --primary: #6C63FF; --primary-light: #8B85FF; --primary-dark: #4A42E8;
  --secondary: #FF6584; --accent: #43D9AD;
  --bg: #0F0F1A; --surface: #1A1A2E; --surface-2: #22223B;
  --border: #2E2E4A; --text: #E8E8F0; --text-muted: #8888AA;
  --success: #43D9AD; --warning: #FFBA08; --danger: #FF6584;
  --radius-sm: 6px; --radius-md: 12px; --radius-lg: 20px;
  --shadow-md: 0 4px 20px rgba(108,99,255,0.15);
  --shadow-lg: 0 8px 40px rgba(108,99,255,0.25);
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }
::-webkit-scrollbar { width:6px; }
::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
```

---

## Verifikasi Modul-00

| Test | Expected |
|------|----------|
| `npm run dev` (frontend) | App di `localhost:5173` |
| `uvicorn main:app --reload` (backend) | API di `localhost:8000` |
| `localhost:8000/docs` | Swagger UI muncul |
| DDL di Supabase SQL Editor | 8 tabel terbuat, tidak ada error |
| Cloudinary dashboard | Upload preset `anaku_gallery` tersedia |
