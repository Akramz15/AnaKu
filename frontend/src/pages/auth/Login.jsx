import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 35.6 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C43 35.2 48 30 48 24c0-1.3-.1-2.6-.4-3.9z"/>
  </svg>
)

export default function Login() {
  const { login }               = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [googleLoad, setGoogleLoad] = useState(false)
  const [statusMsg, setStatusMsg]   = useState(null)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setStatusMsg(null)
    setLoading(true)

    try {
      // login() signs in AND fetches profile atomically into context
      const { session, profile } = await login(email, password)

      // Check pending/rejected status via backend
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/users/me`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        )
        if (res.status === 403) {
          const json = await res.json()
          const detail = json.detail || ''
          if (detail === 'ACCOUNT_PENDING') {
            setStatusMsg({ type: 'pending', text: 'Akun Anda sedang menunggu persetujuan admin.' })
          } else if (detail.startsWith('ACCOUNT_REJECTED')) {
            const reason = detail.split(':')[1] || 'Hubungi admin untuk informasi lebih lanjut.'
            setStatusMsg({ type: 'rejected', text: `Akun Anda ditolak. ${reason}` })
          }
          await supabase.auth.signOut()
          return
        }
      } catch {
        // Backend unreachable — still allow login based on profile data
      }

      // Navigate based on role from profile (already in context)
      const role = profile?.role
      if (role === 'admin') navigate('/admin/children', { replace: true })
      else if (role === 'caregiver') navigate('/caregiver', { replace: true })
      else navigate('/parent', { replace: true })

    } catch (err) {
      toast.error(err.message || 'Email atau password salah')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoad(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { toast.error(error.message); setGoogleLoad(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Selamat Datang</h1>
        <p style={S.subtitle}>
          Belum punya akun?{' '}
          <span style={S.link} onClick={() => navigate('/register')}>Registrasi</span>
        </p>

        {statusMsg && (
          <div style={{
            ...S.banner,
            background: statusMsg.type === 'pending' ? '#FEF9C3' : '#FEE2E2',
            borderColor: statusMsg.type === 'pending' ? '#FDE047' : '#FCA5A5',
            color: statusMsg.type === 'pending' ? '#854D0E' : '#991B1B',
          }}>
            {statusMsg.type === 'pending' ? '⏳' : '❌'} {statusMsg.text}
          </div>
        )}

        <button style={S.googleBtn} onClick={handleGoogle} disabled={googleLoad} type="button">
          <GoogleIcon />
          {googleLoad ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}
        </button>

        <div style={S.divider}><span style={S.dividerText}>atau</span></div>

        <form onSubmit={handleLogin} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>E-mail</label>
            <input style={S.input} type="email" placeholder="example@gmail.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={S.field}>
            <label style={S.label}>Password</label>
            <div style={S.pwWrap}>
              <input
                style={{ ...S.input, paddingRight: '3rem', boxSizing: 'border-box', width: '100%' }}
                type={showPw ? 'text' : 'password'} placeholder="@#*%"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" style={S.eyeBtn} onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ ...S.btn, opacity: loading ? 0.75 : 1 }}>
            {loading ? 'Memuat...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
    background: 'linear-gradient(135deg,#F9E4D4 0%,#FDF6EC 30%,#D4EDD4 65%,#D4E8F9 100%)',
  },
  card: {
    background: '#ffffff', borderRadius: 20, padding: '2.5rem 2.25rem',
    width: '100%', maxWidth: '420px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
  },
  title: { margin: 0, fontSize: '1.9rem', fontWeight: 800, color: '#1A3A6B', textAlign: 'center', letterSpacing: '-0.5px' },
  subtitle: { textAlign: 'center', color: '#64748B', fontSize: '0.88rem', margin: '0.6rem 0 1.25rem' },
  link: { color: '#1A3A6B', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' },
  banner: { borderStyle: 'solid', borderWidth: '1px', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' },
  googleBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
    background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.75rem',
    fontWeight: 600, fontSize: '0.95rem', color: '#334155', cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  divider: { position: 'relative', textAlign: 'center', margin: '1.25rem 0', borderTop: '1px solid #E2E8F0' },
  dividerText: {
    position: 'absolute', top: '-0.65rem', left: '50%', transform: 'translateX(-50%)',
    background: '#fff', padding: '0 0.75rem', color: '#94A3B8', fontSize: '0.82rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: { fontSize: '0.85rem', fontWeight: 500, color: '#475569' },
  input: {
    background: '#F1F5F9', border: '1.5px solid #E2E8F0', borderRadius: 10,
    padding: '0.75rem 1rem', fontSize: '0.93rem', color: '#334155', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  pwWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)',
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
    display: 'flex', alignItems: 'center',
  },
  btn: {
    background: '#84D6FE', color: '#fff', border: 'none', borderRadius: 12,
    padding: '0.85rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
    width: '100%', marginTop: '0.25rem', letterSpacing: '0.3px',
  },
}
