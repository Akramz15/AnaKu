# MODUL-01 — Autentikasi & Manajemen Pengguna

> **Fase:** 1 | **Estimasi:** 1–2 hari | **Prasyarat:** MODUL-00 selesai

---

## Tujuan Modul

Membangun sistem Login, Register, dan Proteksi Halaman berbasis role (parent/caregiver/admin). Frontend terhubung ke Supabase Auth, dan Backend memvalidasi setiap request menggunakan JWT.

---

## Checklist Tugas

- [ ] 1.1 Setup Supabase Auth (matikan email confirmation)
- [ ] 1.2 Buat halaman Login (`/login`)
- [ ] 1.3 Buat halaman Register (`/register`)
- [ ] 1.4 Buat `AuthContext` dan `useAuth` hook
- [ ] 1.5 Buat `ProtectedRoute` (role-based)
- [ ] 1.6 Konfigurasi routing di `App.jsx`
- [ ] 1.7 Backend: JWT Middleware (`deps.py`)
- [ ] 1.8 Backend: Endpoint `GET /api/v1/users/me`

---

## 1.1 — Setup Supabase Auth

Di **Supabase Dashboard**:
1. Masuk ke **Authentication → Providers → Email**
2. Matikan toggle **"Confirm email"** → Save
3. Di **Authentication → URL Configuration**, set:
   - Site URL: `http://localhost:5173`

---

## 1.2 & 1.3 — Halaman Login & Register

### `frontend/src/pages/auth/Login.jsx`
```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { toast.error(error.message); return }

    // Ambil role user dari tabel public.users
    const { data: profile } = await supabase
      .from('users').select('role').eq('id', data.user.id).single()

    if (profile?.role === 'admin') navigate('/admin')
    else if (profile?.role === 'caregiver') navigate('/caregiver')
    else navigate('/parent')
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🐣 AnaKu</div>
        <h1 style={styles.title}>Selamat Datang</h1>
        <p style={styles.sub}>Masuk untuk memantau si kecil</p>
        <form onSubmit={handleLogin} style={styles.form}>
          <input style={styles.input} type="email" placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={styles.input} type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Memuat...' : 'Masuk'}
          </button>
        </form>
        <p style={styles.link}>Belum punya akun? <Link to="/register">Daftar</Link></p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'var(--bg)' },
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'2.5rem', width:'100%', maxWidth:'420px', boxShadow:'var(--shadow-lg)' },
  logo: { fontSize:'2rem', textAlign:'center', marginBottom:'1rem' },
  title: { fontSize:'1.6rem', fontWeight:700, textAlign:'center', marginBottom:'0.25rem' },
  sub: { color:'var(--text-muted)', textAlign:'center', marginBottom:'2rem', fontSize:'0.9rem' },
  form: { display:'flex', flexDirection:'column', gap:'1rem' },
  input: { background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
    padding:'0.8rem 1rem', color:'var(--text)', fontSize:'0.95rem', outline:'none' },
  btn: { background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-md)',
    padding:'0.9rem', fontWeight:600, fontSize:'1rem', cursor:'pointer', marginTop:'0.5rem',
    transition:'opacity 0.2s' },
  link: { textAlign:'center', marginTop:'1.5rem', color:'var(--text-muted)', fontSize:'0.9rem' }
}
```

### `frontend/src/pages/auth/Register.jsx`
```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const ROLES = [
  { value:'parent',    label:'Orang Tua' },
  { value:'caregiver', label:'Pengasuh' },
  { value:'admin',     label:'Admin Daycare' },
]

export default function Register() {
  const [form, setForm] = useState({ full_name:'', email:'', password:'', role:'parent' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: form.role } }
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Akun berhasil dibuat! Silakan login.')
    navigate('/login')
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🐣 AnaKu</div>
        <h1 style={styles.title}>Buat Akun</h1>
        <form onSubmit={handleRegister} style={styles.form}>
          <input style={styles.input} placeholder="Nama Lengkap"
            value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
          <input style={styles.input} type="email" placeholder="Email"
            value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <input style={styles.input} type="password" placeholder="Password (min 6 karakter)"
            value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <select style={styles.input} value={form.role}
            onChange={e => setForm({...form, role: e.target.value})}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
          </button>
        </form>
        <p style={styles.link}>Sudah punya akun? <Link to="/login">Masuk</Link></p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' },
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'2.5rem', width:'100%', maxWidth:'420px', boxShadow:'var(--shadow-lg)' },
  logo: { fontSize:'2rem', textAlign:'center', marginBottom:'1rem' },
  title: { fontSize:'1.6rem', fontWeight:700, textAlign:'center', marginBottom:'1.5rem' },
  form: { display:'flex', flexDirection:'column', gap:'1rem' },
  input: { background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
    padding:'0.8rem 1rem', color:'var(--text)', fontSize:'0.95rem', outline:'none' },
  btn: { background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-md)',
    padding:'0.9rem', fontWeight:600, fontSize:'1rem', cursor:'pointer' },
  link: { textAlign:'center', marginTop:'1.5rem', color:'var(--text-muted)', fontSize:'0.9rem' }
}
```

---

## 1.4 — AuthContext & useAuth Hook

### `frontend/src/context/AuthContext.jsx`
```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // Supabase auth user
  const [profile, setProfile] = useState(null) // data dari public.users (termasuk role)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

---

## 1.5 — ProtectedRoute (Role-Based)

### `frontend/src/routes/ProtectedRoute.jsx`
```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// allowedRoles: array of string, contoh: ['parent'] atau ['admin','caregiver']
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div style={{color:'#fff',textAlign:'center',marginTop:'4rem'}}>Memuat...</div>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(profile?.role)) return <Navigate to="/login" replace />

  return children
}
```

---

## 1.6 — App.jsx (Routing Lengkap)

### `frontend/src/App.jsx`
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ParentDashboard from './pages/parent/ParentDashboard'
import AIChatbot from './pages/parent/AIChatbot'
import ParentGallery from './pages/parent/Gallery'
import ParentBilling from './pages/parent/Billing'
import ParentChat from './pages/parent/ParentChat'
import CaregiverDashboard from './pages/caregiver/CaregiverDashboard'
import DailyLogForm from './pages/caregiver/DailyLogForm'
import GalleryUpload from './pages/caregiver/GalleryUpload'
import CaregiverChat from './pages/caregiver/CaregiverChat'
import AdminDashboard from './pages/admin/AdminDashboard'
import ChildrenManagement from './pages/admin/ChildrenManagement'
import QRGenerator from './pages/admin/QRGenerator'
import QRScanner from './pages/admin/QRScanner'
import BillingManagement from './pages/admin/BillingManagement'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Parent Routes */}
          <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
          <Route path="/parent/ai-chat" element={<ProtectedRoute allowedRoles={['parent']}><AIChatbot /></ProtectedRoute>} />
          <Route path="/parent/gallery" element={<ProtectedRoute allowedRoles={['parent']}><ParentGallery /></ProtectedRoute>} />
          <Route path="/parent/billing" element={<ProtectedRoute allowedRoles={['parent']}><ParentBilling /></ProtectedRoute>} />
          <Route path="/parent/chat" element={<ProtectedRoute allowedRoles={['parent']}><ParentChat /></ProtectedRoute>} />

          {/* Caregiver Routes */}
          <Route path="/caregiver" element={<ProtectedRoute allowedRoles={['caregiver']}><CaregiverDashboard /></ProtectedRoute>} />
          <Route path="/caregiver/daily-log" element={<ProtectedRoute allowedRoles={['caregiver']}><DailyLogForm /></ProtectedRoute>} />
          <Route path="/caregiver/gallery" element={<ProtectedRoute allowedRoles={['caregiver']}><GalleryUpload /></ProtectedRoute>} />
          <Route path="/caregiver/chat" element={<ProtectedRoute allowedRoles={['caregiver']}><CaregiverChat /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/children" element={<ProtectedRoute allowedRoles={['admin']}><ChildrenManagement /></ProtectedRoute>} />
          <Route path="/admin/qr-generator" element={<ProtectedRoute allowedRoles={['admin']}><QRGenerator /></ProtectedRoute>} />
          <Route path="/admin/qr-scanner" element={<ProtectedRoute allowedRoles={['admin']}><QRScanner /></ProtectedRoute>} />
          <Route path="/admin/billing" element={<ProtectedRoute allowedRoles={['admin']}><BillingManagement /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

---

## 1.7 — Backend: JWT Middleware

### `backend/api/deps.py`
```python
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from core.config import settings
from supabase import create_client

security = HTTPBearer()
supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token tidak valid")

        # Ambil profile dari public.users (termasuk role)
        result = supabase_admin.table("users").select("*").eq("id", user_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")

        return result.data  # dict berisi id, full_name, role, dst
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

def require_role(*roles):
    async def checker(current_user = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Akses ditolak. Role diperlukan: {roles}")
        return current_user
    return checker
```

---

## 1.8 — Backend: Endpoint Users

### `backend/api/endpoints/users.py`
```python
from fastapi import APIRouter, Depends
from api.deps import get_current_user, require_role
from supabase import create_client
from core.config import settings

router = APIRouter()
supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.get("/me")
async def get_my_profile(current_user = Depends(get_current_user)):
    """Ambil data profil user yang sedang login"""
    return {"status": "success", "data": current_user}

@router.put("/me")
async def update_my_profile(
    payload: dict,
    current_user = Depends(get_current_user)
):
    """Update profil (full_name, phone, avatar_url)"""
    allowed = {k: v for k, v in payload.items() if k in ['full_name','phone','avatar_url']}
    result = supabase_admin.table("users").update(allowed).eq("id", current_user["id"]).execute()
    return {"status": "success", "data": result.data}

@router.get("/", dependencies=[Depends(require_role("admin"))])
async def list_users():
    """[Admin Only] Daftar semua user"""
    result = supabase_admin.table("users").select("*").execute()
    return {"status": "success", "data": result.data}
```

---

## Verifikasi Modul-01

| Test | Expected |
|------|----------|
| Buka `/register` → isi form → submit | Redirect ke `/login`, toast sukses |
| Login sebagai parent | Redirect ke `/parent` |
| Login sebagai caregiver | Redirect ke `/caregiver` |
| Login sebagai admin | Redirect ke `/admin` |
| Akses `/parent` tanpa login | Redirect ke `/login` |
| Akses `/admin` sebagai parent | Redirect ke `/login` |
| `GET /api/v1/users/me` tanpa token | `401 Unauthorized` |
| `GET /api/v1/users/me` dengan token valid | Mengembalikan data profil + role |
