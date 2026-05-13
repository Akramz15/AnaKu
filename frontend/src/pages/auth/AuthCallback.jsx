import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

/**
 * Route: /auth/callback
 * Menangani redirect dari Google OAuth.
 * Mengecek apakah user sudah punya profil lengkap (phone).
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState('Memproses login...')

  useEffect(() => {
    const handle = async () => {
      // Tunggu Supabase memproses session dari URL hash
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        setMsg('Gagal memproses login. Kembali ke halaman login...')
        setTimeout(() => navigate('/login'), 2000)
        return
      }

      const userId = session.user.id
      const token  = session.access_token

      // Cek profil di public.users
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/users/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // 403 → akun pending/rejected
      if (res.status === 403) {
        const json = await res.json()
        const detail = json.detail || ''
        if (detail === 'ACCOUNT_PENDING') {
          await supabase.auth.signOut()
          toast.success('Akun Anda sedang dalam antrean verifikasi admin. Silakan cek email Anda.', { duration: 5000 })
          navigate('/login')
        } else if (detail.startsWith('ACCOUNT_REJECTED')) {
          await supabase.auth.signOut()
          toast.error('Pendaftaran Anda ditolak. Silakan hubungi admin.', { duration: 5000 })
          navigate('/login')
        }
        return
      }

      // 404 → profil belum ada (user baru via Google, belum punya phone)
      if (res.status === 404) {
        navigate('/complete-profile')
        return
      }

      if (!res.ok) {
        navigate('/login')
        return
      }

      const profile = await res.json()
      const user = profile?.data

      // 1. Cek status pending/rejected FIRST
      if (user?.status === 'pending') {
        await supabase.auth.signOut()
        toast.success('Akun Anda sedang dalam antrean verifikasi admin.', { duration: 5000 })
        navigate('/login')
        return
      }

      // 2. Profil AKTIF tapi phone belum diisi (Baru disetujui admin via Google flow) -> Lengkapi profil!
      if (!user?.phone) {
        navigate('/complete-profile')
        return
      }

      // Semua OK → arahkan ke dashboard sesuai role
      const role = user?.role
      if (role === 'admin')          navigate('/admin/children')
      else if (role === 'caregiver') navigate('/caregiver')
      else                           navigate('/parent')
    }

    handle()
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F9E4D4 0%, #FDF6EC 30%, #D4EDD4 65%, #D4E8F9 100%)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '2.5rem 3rem',
        textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
        <p style={{ color: '#475569', fontSize: '1rem', fontWeight: 500 }}>{msg}</p>
      </div>
    </div>
  )
}
