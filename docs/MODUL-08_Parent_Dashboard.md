# MODUL-08 — Parent Dashboard (Kompilasi Semua Fitur)

> **Fase:** 8 | **Estimasi:** 1–2 hari | **Prasyarat:** MODUL-03, 04, 05, 06, 07

---

## Tujuan Modul

Membangun halaman utama orang tua yang menampilkan semua informasi penting dalam satu tampilan: status kehadiran, ringkasan harian, cerita AI, grafik emosi, dan navigasi cepat ke semua fitur.

---

## Checklist Tugas

- [ ] 8.1 Layout Sidebar + Navbar (komponen reusable)
- [ ] 8.2 Parent Dashboard — kartu status & ringkasan
- [ ] 8.3 Integrasi AI Story Card (Feature C)
- [ ] 8.4 Integrasi Emotion Trend Chart (Feature B)
- [ ] 8.5 Quick Navigation Cards
- [ ] 8.6 Caregiver Dashboard (ringkasan tugas harian)
- [ ] 8.7 Admin Dashboard (overview statistik)

---

## 8.1 — Layout Komponen

### `frontend/src/components/layout/Sidebar.jsx`
```jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_PARENT = [
  { to:'/parent',          icon:'🏠', label:'Dashboard' },
  { to:'/parent/ai-chat',  icon:'🤖', label:'AI Asisten' },
  { to:'/parent/gallery',  icon:'🖼️', label:'Galeri' },
  { to:'/parent/billing',  icon:'💰', label:'Tagihan' },
  { to:'/parent/chat',     icon:'💬', label:'Chat' },
]
const NAV_CAREGIVER = [
  { to:'/caregiver',           icon:'🏠', label:'Dashboard' },
  { to:'/caregiver/daily-log', icon:'📋', label:'Daily Log' },
  { to:'/caregiver/gallery',   icon:'📸', label:'Upload Foto' },
  { to:'/caregiver/chat',      icon:'💬', label:'Chat' },
]
const NAV_ADMIN = [
  { to:'/admin',              icon:'🏠', label:'Dashboard' },
  { to:'/admin/children',     icon:'👶', label:'Data Anak' },
  { to:'/admin/qr-generator', icon:'🔲', label:'QR Generator' },
  { to:'/admin/qr-scanner',   icon:'📷', label:'Scan QR' },
  { to:'/admin/billing',      icon:'💰', label:'Tagihan' },
]

export default function Sidebar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = profile?.role === 'parent' ? NAV_PARENT
                 : profile?.role === 'caregiver' ? NAV_CAREGIVER : NAV_ADMIN

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>🐣 AnaKu</div>

      {/* User Info */}
      <div style={styles.userCard}>
        <div style={styles.avatar}>{profile?.full_name?.[0] || '?'}</div>
        <div>
          <div style={styles.userName}>{profile?.full_name}</div>
          <div style={styles.userRole}>
            {profile?.role === 'parent' ? '👨‍👩‍👧 Orang Tua'
            : profile?.role === 'caregiver' ? '👩‍🏫 Pengasuh'
            : '⚙️ Admin'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end style={({ isActive }) => ({
            ...styles.navItem, ...(isActive ? styles.navActive : {})
          })}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button style={styles.logoutBtn} onClick={handleLogout}>🚪 Keluar</button>
    </aside>
  )
}

const styles = {
  sidebar:   { width:'240px', minHeight:'100vh', background:'var(--surface)',
               borderRight:'1px solid var(--border)', display:'flex',
               flexDirection:'column', padding:'1.5rem 1rem', flexShrink:0 },
  logo:      { fontSize:'1.5rem', fontWeight:800, marginBottom:'1.5rem',
               color:'var(--primary)', textAlign:'center', letterSpacing:'-0.5px' },
  userCard:  { display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem',
               background:'var(--surface-2)', borderRadius:'var(--radius-md)', marginBottom:'1.5rem' },
  avatar:    { width:'36px', height:'36px', borderRadius:'50%', background:'var(--primary)',
               display:'flex', alignItems:'center', justifyContent:'center',
               fontWeight:700, color:'#fff', flexShrink:0 },
  userName:  { fontWeight:600, fontSize:'0.85rem', whiteSpace:'nowrap', overflow:'hidden',
               textOverflow:'ellipsis', maxWidth:'130px' },
  userRole:  { fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.1rem' },
  nav:       { display:'flex', flexDirection:'column', gap:'0.25rem', flex:1 },
  navItem:   { display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.7rem 0.9rem',
               borderRadius:'var(--radius-md)', textDecoration:'none', color:'var(--text-muted)',
               fontSize:'0.9rem', transition:'all 0.2s', fontWeight:500 },
  navActive: { background:'rgba(108,99,255,0.15)', color:'var(--primary)',
               borderLeft:'3px solid var(--primary)' },
  logoutBtn: { background:'transparent', border:'1px solid var(--border)',
               color:'var(--text-muted)', borderRadius:'var(--radius-md)', padding:'0.65rem',
               cursor:'pointer', marginTop:'1rem', fontSize:'0.85rem',
               transition:'all 0.2s' },
}
```

### `frontend/src/components/layout/PageLayout.jsx`
```jsx
import Sidebar from './Sidebar'

export default function PageLayout({ children }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex:1, overflowY:'auto' }}>
        {children}
      </main>
    </div>
  )
}
```

---

## 8.2 — Parent Dashboard

### `frontend/src/pages/parent/ParentDashboard.jsx`
```jsx
import { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import EmotionTrendChart from '../../components/charts/EmotionTrendChart'
import DailyStoryCard from '../../components/DailyStoryCard'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/axios'
import { useNavigate } from 'react-router-dom'

const MEAL_EMOJI = { habis:'✅', setengah:'🥣', tidak_makan:'❌' }
const MOOD_EMOJI = { ceria:'😄', biasa:'😊', rewel:'😤', menangis:'😢' }
const MOOD_COLOR = { ceria:'var(--success)', biasa:'var(--primary)', rewel:'var(--warning)', menangis:'var(--danger)' }

export default function ParentDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayLog, setTodayLog] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [trendData, setTrendData] = useState([])

  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      setChildren(r.data.data)
      if (r.data.data[0]) setSelectedChild(r.data.data[0])
    })
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    const today = new Date().toISOString().split('T')[0]
    const cid = selectedChild.id

    Promise.all([
      api.get(`/api/v1/daily-logs?child_id=${cid}&log_date=${today}`),
      api.get(`/api/v1/attendances?child_id=${cid}`),
      api.get(`/api/v1/daily-logs/sentiment-trend?child_id=${cid}`),
    ]).then(([logRes, attRes, trendRes]) => {
      setTodayLog(logRes.data.data[0] || null)
      const todayAtt = attRes.data.data.find(a => a.date === today)
      setTodayAttendance(todayAtt || null)
      setTrendData(trendRes.data.data)
    })
  }, [selectedChild])

  const QUICK_NAV = [
    { icon:'🤖', label:'AI Asisten', desc:'Tanya kondisi si kecil', path:'/parent/ai-chat', color:'#6C63FF' },
    { icon:'🖼️', label:'Galeri',     desc:'Foto & video aktivitas', path:'/parent/gallery',  color:'#FF6584' },
    { icon:'💰', label:'Tagihan',    desc:'Status pembayaran',       path:'/parent/billing',  color:'#FFBA08' },
    { icon:'💬', label:'Chat',       desc:'Hubungi pengasuh',        path:'/parent/chat',     color:'#43D9AD' },
  ]

  return (
    <PageLayout>
      <div style={styles.page}>
        {/* Greeting */}
        <div style={styles.greeting}>
          <div>
            <h1 style={styles.greetTitle}>
              Halo, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <p style={styles.greetSub}>
              {new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          {children.length > 1 && (
            <select style={styles.childSwitch} value={selectedChild?.id || ''}
              onChange={e => setSelectedChild(children.find(c => c.id === e.target.value))}>
              {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          )}
        </div>

        {/* Status Cards Row */}
        <div style={styles.statsRow}>
          {/* Status Kehadiran */}
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🏫</div>
            <div style={styles.statLabel}>Status Hari Ini</div>
            {todayAttendance ? (
              <div>
                <div style={styles.statValue}>✅ Hadir</div>
                <div style={styles.statMeta}>
                  Masuk: {todayAttendance.check_in_at
                    ? new Date(todayAttendance.check_in_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
                    : '-'}
                </div>
                <div style={styles.statMeta}>
                  Pulang: {todayAttendance.check_out_at
                    ? new Date(todayAttendance.check_out_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
                    : '(belum checkout)'}
                </div>
              </div>
            ) : <div style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Belum tercatat</div>}
          </div>

          {/* Mood */}
          <div style={styles.statCard}>
            <div style={styles.statIcon}>😊</div>
            <div style={styles.statLabel}>Mood Hari Ini</div>
            {todayLog?.mood
              ? <div style={{ fontSize:'2rem' }}>{MOOD_EMOJI[todayLog.mood]}</div>
              : <div style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Belum diisi</div>}
            {todayLog?.mood && (
              <div style={{ color: MOOD_COLOR[todayLog.mood], fontWeight:600, marginTop:'0.25rem' }}>
                {todayLog.mood.charAt(0).toUpperCase() + todayLog.mood.slice(1)}
              </div>
            )}
          </div>

          {/* Makan */}
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🍽️</div>
            <div style={styles.statLabel}>Laporan Makan</div>
            {todayLog ? (
              <div style={{ fontSize:'0.85rem', display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                <span>🌅 Pagi: {MEAL_EMOJI[todayLog.meal_morning] || '-'}</span>
                <span>☀️ Siang: {MEAL_EMOJI[todayLog.meal_lunch] || '-'}</span>
                <span>🍎 Snack: {MEAL_EMOJI[todayLog.meal_snack] || '-'}</span>
              </div>
            ) : <div style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Belum diisi</div>}
          </div>

          {/* Tidur */}
          <div style={styles.statCard}>
            <div style={styles.statIcon}>😴</div>
            <div style={styles.statLabel}>Tidur Siang</div>
            {todayLog?.sleep_duration_min != null
              ? <div style={styles.statValue}>{todayLog.sleep_duration_min} menit</div>
              : <div style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Belum diisi</div>}
            {todayLog?.sleep_quality && (
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>
                Kualitas: {todayLog.sleep_quality}
              </div>
            )}
          </div>
        </div>

        {/* AI Story + Emotion Trend */}
        <div style={styles.twoCol}>
          <div style={{ flex:1.5 }}>
            <DailyStoryCard
              story={todayLog?.ai_daily_summary}
              childName={selectedChild?.full_name}
              generatedAt={todayLog?.summary_generated_at}
            />
          </div>
          <div style={{ flex:1, background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)', padding:'1.25rem' }}>
            <div style={{ fontWeight:700, marginBottom:'0.75rem', display:'flex',
              alignItems:'center', gap:'0.5rem' }}>
              📊 Tren Emosi 7 Hari
            </div>
            {trendData.length > 0
              ? <EmotionTrendChart data={trendData} />
              : <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>
                  Data sentimen belum tersedia. Pengasuh perlu mengisi daily log terlebih dahulu.
                </p>
            }
          </div>
        </div>

        {/* Quick Navigation */}
        <div>
          <h3 style={{ marginBottom:'1rem', fontWeight:700 }}>⚡ Akses Cepat</h3>
          <div style={styles.quickGrid}>
            {QUICK_NAV.map(item => (
              <div key={item.path} style={{...styles.quickCard, borderColor: item.color + '40'}}
                onClick={() => navigate(item.path)}>
                <div style={{...styles.quickIcon, background: item.color + '20', color: item.color}}>
                  {item.icon}
                </div>
                <div style={styles.quickLabel}>{item.label}</div>
                <div style={styles.quickDesc}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

const styles = {
  page:        { padding:'2rem', display:'flex', flexDirection:'column', gap:'1.5rem' },
  greeting:    { display:'flex', justifyContent:'space-between', alignItems:'center' },
  greetTitle:  { fontSize:'1.6rem', fontWeight:800 },
  greetSub:    { color:'var(--text-muted)', fontSize:'0.9rem', marginTop:'0.25rem' },
  childSwitch: { background:'var(--surface)', border:'1px solid var(--border)',
                 borderRadius:'var(--radius-md)', padding:'0.5rem 1rem', color:'var(--text)' },
  statsRow:    { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem' },
  statCard:    { background:'var(--surface)', border:'1px solid var(--border)',
                 borderRadius:'var(--radius-lg)', padding:'1.25rem' },
  statIcon:    { fontSize:'1.5rem', marginBottom:'0.5rem' },
  statLabel:   { fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600,
                 textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.5rem' },
  statValue:   { fontWeight:700, fontSize:'1.1rem' },
  statMeta:    { fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'0.2rem' },
  twoCol:      { display:'flex', gap:'1rem', flexWrap:'wrap' },
  quickGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'1rem' },
  quickCard:   { background:'var(--surface)', border:'1px solid', borderRadius:'var(--radius-lg)',
                 padding:'1.25rem', cursor:'pointer', transition:'transform 0.2s, box-shadow 0.2s',
                 ':hover': { transform:'translateY(-2px)' } },
  quickIcon:   { width:'48px', height:'48px', borderRadius:'var(--radius-md)',
                 display:'flex', alignItems:'center', justifyContent:'center',
                 fontSize:'1.5rem', marginBottom:'0.75rem' },
  quickLabel:  { fontWeight:700, marginBottom:'0.25rem' },
  quickDesc:   { fontSize:'0.8rem', color:'var(--text-muted)' },
}
```

---

## 8.6 — Caregiver Dashboard

### `frontend/src/pages/caregiver/CaregiverDashboard.jsx`
```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../../components/layout/PageLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/axios'

export default function CaregiverDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [todayLogs, setTodayLogs] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      api.get('/api/v1/children'),
      api.get(`/api/v1/daily-logs?log_date=${today}`),
    ]).then(([c, l]) => {
      setChildren(c.data.data.filter(ch => ch.is_active))
      setTodayLogs(l.data.data)
    })
  }, [])

  const loggedIds = new Set(todayLogs.map(l => l.child_id))
  const QUICK = [
    { icon:'📋', label:'Isi Daily Log', path:'/caregiver/daily-log', color:'var(--primary)' },
    { icon:'📸', label:'Upload Foto',   path:'/caregiver/gallery',   color:'var(--secondary)' },
    { icon:'💬', label:'Chat',          path:'/caregiver/chat',      color:'var(--accent)' },
  ]

  return (
    <PageLayout>
      <div style={{ padding:'2rem', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:800 }}>Halo, {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>
            Hari ini ada <strong>{children.length}</strong> anak aktif · 
            <strong> {todayLogs.length}/{children.length}</strong> laporan sudah diisi
          </p>
        </div>

        {/* Quick Nav */}
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          {QUICK.map(q => (
            <button key={q.path} style={{ background:'var(--surface)', border:`1px solid ${q.color}40`,
              borderRadius:'var(--radius-md)', padding:'0.85rem 1.25rem', display:'flex',
              gap:'0.5rem', alignItems:'center', cursor:'pointer', color:'var(--text)',
              fontWeight:600, fontSize:'0.9rem' }} onClick={() => navigate(q.path)}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>

        {/* Daftar Anak + Status Log */}
        <div>
          <h3 style={{ marginBottom:'1rem' }}>📋 Status Laporan Harian</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            {children.map(child => (
              <div key={child.id} style={{ background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-md)', padding:'1rem 1.25rem',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <span style={{ fontSize:'1.5rem' }}>{child.gender==='male'?'👦':'👧'}</span>
                  <span style={{ fontWeight:600 }}>{child.full_name}</span>
                </div>
                {loggedIds.has(child.id)
                  ? <span style={{ color:'var(--success)', fontWeight:600, fontSize:'0.85rem' }}>✅ Sudah Diisi</span>
                  : <button style={{ background:'var(--primary)', color:'#fff', border:'none',
                      borderRadius:'var(--radius-sm)', padding:'0.4rem 0.85rem',
                      cursor:'pointer', fontSize:'0.8rem' }}
                    onClick={() => navigate('/caregiver/daily-log')}>Isi Sekarang</button>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
```

---

## Verifikasi Modul-08

| Test | Expected |
|------|----------|
| Parent login → dashboard | Kartu status kehadiran, makan, tidur, mood tampil |
| Sebelum checkout | DailyStoryCard tampilkan placeholder |
| Setelah checkout | Cerita AI tampil di DailyStoryCard |
| Data sentimen tersedia | Grafik tren 7 hari tampil berwarna |
| Klik "AI Asisten" | Navigasi ke `/parent/ai-chat` |
| Caregiver login | Dashboard tampilkan daftar anak + status log |
| Sidebar navigasi | Semua link berfungsi sesuai role |
