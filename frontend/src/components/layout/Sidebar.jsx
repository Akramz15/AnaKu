import { useEffect, useState, cloneElement } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Home, ClipboardList, Image, Users, MessageCircle, CreditCard, UserCheck, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../lib/axios'

const NAV_PARENT = [
  { to:'/parent',           icon:<Home size={20} />,          label:'Beranda' },
  { to:'/parent/daily-log', icon:<ClipboardList size={20} />, label:'Laporan Harian' },
  { to:'/parent/gallery',   icon:<Image size={20} />,         label:'Galeri' },
  { to:'/parent/chat',      icon:<Users size={20} />,         label:'Chat Pengasuh' },
  { to:'/parent/ai-chat',   icon:<MessageCircle size={20} />, label:'Tanya AI' },
  { to:'/parent/billing',   icon:<CreditCard size={20} />,    label:'Pembayaran' },
]
const NAV_CAREGIVER = [
  { to:'/caregiver',            icon:<Home size={20} />,          label:'Beranda' },
  { to:'/caregiver/chat',       icon:<Users size={20} />,         label:'Chat Orang Tua' },
  { to:'/caregiver/daily-log',  icon:<ClipboardList size={20} />, label:'Input' },
  { to:'/caregiver/gallery',    icon:<Image size={20} />,         label:'Galeri' },
]

export default function Sidebar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const getLogoutText = () => {
    if (profile?.role === 'caregiver') return 'Anda harus login kembali untuk mengelola aktivitas harian anak.'
    if (profile?.role === 'admin') return 'Anda harus login kembali untuk mengakses panel manajemen sistem.'
    return 'Anda harus login kembali untuk mengakses dashboard si kecil.'
  }

  // Fetch pending badge for admin
  useEffect(() => {
    if (profile?.role !== 'admin') return
    const fetch = () =>
      api.get('/api/v1/registrations/count')
        .then(r => setPendingCount(r.data.count || 0))
        .catch(() => {})
    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [profile?.role])

  const NAV_ADMIN = [
    { to:'/admin/children',       icon:<Users size={20} />,      label:'Daftar Anak' },
    { to:'/admin/registrations',  icon:<UserCheck size={20} />,  label:'Persetujuan Akun', badge: pendingCount },
    { to:'/admin/billing',        icon:<CreditCard size={20} />, label:'Pembayaran' },
  ]

  const navItems = profile?.role === 'parent' ? NAV_PARENT
                 : profile?.role === 'caregiver' ? NAV_CAREGIVER : NAV_ADMIN

  const [showConfirm, setShowConfirm] = useState(false)

  const handleLogout = async () => { 
    setShowConfirm(false)
    await logout()
    navigate('/login') 
  }

  return (
    <>
      <aside className="mobile-bottom-nav" style={{
        ...styles.sidebar,
        width: isCollapsed ? '80px' : '260px',
      }}>
        {/* Collapse Toggle Button */}
        <button 
          style={styles.collapseBtn} 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo */}
        <div className="logo" style={{...styles.logo, justifyContent: isCollapsed ? 'center' : 'flex-start'}}>
          <img src="/Logo AnaKu.png" alt="AnaKu Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          {!isCollapsed && <span style={{color: '#1E293B'}}>AnaKuu</span>}
        </div>

        {/* Navigation */}
        <nav style={styles.nav}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navActive : {}),
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '0.8rem 0' : '0.8rem 1rem'
            })}>
              {({ isActive }) => (
                <>
                  <span style={{ 
                    color: isActive ? '#0F172A' : '#64748B', 
                    display: 'flex', 
                    alignItems: 'center',
                    transition: 'color 0.2s' 
                  }}>
                    {cloneElement(item.icon, { strokeWidth: isActive ? 2.8 : 2 })}
                  </span>
                  {!isCollapsed && <span className="nav-text" style={{ flex: 1 }}>{item.label}</span>}
                  {!isCollapsed && item.badge > 0 && (
                    <span style={styles.badge}>{item.badge}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
          {/* Logout integrated inside NAV to flow into mobile bottom tab row */}
          <a href="#" style={{
            ...styles.navItem,
            marginTop: 'auto',
            cursor: 'pointer',
            color: '#DC2626',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            padding: isCollapsed ? '0.8rem 0' : '0.8rem 1rem',
          }} onClick={(e) => { e.preventDefault(); setShowConfirm(true) }}>
            <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center' }}><LogOut size={20} /></span>
            {!isCollapsed && <span className="nav-text" style={{ flex: 1 }}>Log out</span>}
          </a>
        </nav>
      </aside>

      {/* Premium Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            padding: '2rem',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '380px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.03)',
            textAlign: 'center',
            border: '1px solid #F1F5F9'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', color: '#EF4444'
            }}>
              <LogOut size={24} />
            </div>
            
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
              Apakah anda yakin ingin logout?
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748B', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              {getLogoutText()}
            </p>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#F1F5F9', // abu muda
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Batal
              </button>
              <button 
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#2563EB', // biru
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  sidebar: { 
    height: '100%', 
    background: '#FFFFFF',
    borderRadius: '24px',
    display: 'flex', 
    flexDirection: 'column', 
    padding: '2rem 1rem',
    flexShrink: 0, 
    position: 'relative',
    transition: 'width 0.3s ease',
    boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
    border: '1px solid #FDECE8',
    boxSizing: 'border-box'
  },
  collapseBtn: {
    position: 'absolute',
    right: '-12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748B',
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  logo: { 
    fontSize: '1.3rem', 
    fontWeight: 800, 
    marginBottom: '2.5rem',
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.6rem',
    padding: '0 0.5rem'
  },
  nav: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '0.25rem', 
    flex: 1 
  },
  navItem: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '1rem', 
    borderRadius: '12px', 
    textDecoration: 'none', 
    color: '#475569',
    fontSize: '0.9rem', 
    transition: 'all 0.2s', 
    fontWeight: 500 
  },
  navActive: { 
    color: '#0F172A', 
    fontWeight: 700,
    background: '#F8FAFC'
  },
  badge: {
    background: '#DC2626', 
    color: '#fff', 
    borderRadius: 20,
    fontSize: '0.72rem', 
    fontWeight: 700, 
    padding: '0.1rem 0.5rem',
    minWidth: 20, 
    textAlign: 'center',
  },
  logoutBtn: { 
    background: 'transparent', 
    border: 'none',
    color: '#DC2626', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.75rem',
    cursor: 'pointer', 
    fontSize: '0.9rem', 
    fontWeight: 600, 
    transition: 'all 0.2s',
    borderRadius: '8px'
  },
}
