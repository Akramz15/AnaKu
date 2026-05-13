import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import api from '../../lib/axios'

/**
 * Route: /complete-profile
 * Muncul setelah Google OAuth jika user belum punya phone / nama lengkap.
 * Setelah submit → status menjadi 'pending' → redirect ke /pending.
 */
export default function CompleteProfile() {
  const { refreshProfile } = useAuth()
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/login'); return }
      setSession(session)
      // Pre-fill nama dari Google
      const name = session.user.user_metadata?.full_name || ''
      setForm(f => ({ ...f, full_name: name }))
    })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.full_name.trim().length < 3) return toast.error('Nama minimal 3 karakter')
    if (!/^\d{10,}$/.test(form.phone.replace(/\D/g, ''))) return toast.error('No. HP minimal 10 digit')

    setLoading(true)
    try {
      // Panggil endpoint khusus registrasi (tanpa middleware get_current_user)
      const { data } = await api.post('/api/v1/registrations/complete-profile', {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
      }, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      
      if (data.is_active) {
        // User sudah disetujui sebelumnya oleh admin -> LANGSUNG MASUK DASHBOARD
        toast.success('Profil berhasil dilengkapi. Selamat Datang!', { duration: 4000 })
        await refreshProfile() // Pastikan profile context langsung berisi data terbaru/phone terisi
        navigate('/auth/callback') // Akan mengarahkan ke dashboard sesuai role
      } else {
        // Kasus user baru (belum disetujui admin) -> Force logout agar menunggu verifikasi
        await supabase.auth.signOut()
        toast.success('Pendaftaran Berhasil! Menunggu verifikasi admin.', { duration: 6000 })
        navigate('/login')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menyimpan profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>👤</div>
        <h1 style={S.title}>Lengkapi Profil Anda</h1>
        <p style={S.subtitle}>
          Kami memerlukan beberapa informasi tambahan<br />sebelum akun Anda dapat diproses.
        </p>

        <form onSubmit={handleSubmit} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>Nama Lengkap</label>
            <input style={S.input} placeholder="Masukkan nama lengkap"
              value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div style={S.field}>
            <label style={S.label}>No. HP</label>
            <input style={S.input} type="tel" placeholder="08xxxxxxxxxx"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
          </div>
          <button type="submit" disabled={loading} style={{ ...S.btn, opacity: loading ? 0.75 : 1 }}>
            {loading ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
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
    background: 'linear-gradient(135deg, #F9E4D4 0%, #FDF6EC 30%, #D4EDD4 65%, #D4E8F9 100%)',
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '2.5rem 2.25rem',
    width: '100%', maxWidth: '400px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
  },
  title: { margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1A3A6B', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#64748B', fontSize: '0.88rem', margin: '0.6rem 0 1.5rem', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: { fontSize: '0.85rem', fontWeight: 500, color: '#475569' },
  input: {
    background: '#F1F5F9', border: '1.5px solid #E2E8F0', borderRadius: 10,
    padding: '0.75rem 1rem', fontSize: '0.93rem', color: '#334155',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  btn: {
    background: '#84D6FE', color: '#fff', border: 'none', borderRadius: 12,
    padding: '0.85rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
    width: '100%', marginTop: '0.5rem',
  },
}
