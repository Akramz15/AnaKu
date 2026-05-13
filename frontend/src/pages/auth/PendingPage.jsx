import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useState } from 'react'

/**
 * Route: /pending
 * Halaman menunggu persetujuan admin.
 */
export default function PendingPage() {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(132, 214, 254, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(132, 214, 254, 0); }
          100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(132, 214, 254, 0); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
      <div style={S.page}>
        {/* Background Decorative Circles */}
        <div style={{...S.circle, background: '#F9E4D4', width: 400, height: 400, top: '-10%', left: '-5%'}} />
        <div style={{...S.circle, background: '#D4E8F9', width: 350, height: 350, bottom: '-5%', right: '-5%'}} />

        <div style={S.card}>
          {/* Icon Area */}
          <div style={S.iconWrapper}>
            <div style={S.iconBg}>
              <span style={S.icon}>⏳</span>
            </div>
          </div>

          <h1 style={S.title}>Pendaftaran Berhasil!</h1>
          
          <div style={S.tag}>Status: Menunggu Persetujuan</div>

          <p style={S.body}>
            Terima kasih telah bergabung dengan AnaKuu! Akun Anda sedang dalam proses verifikasi oleh Admin Daycare.
          </p>
          <p style={S.body}>
            Anda akan menerima <strong>email notifikasi</strong> segera setelah akun diaktifkan. Proses ini biasanya membutuhkan waktu maksimal 1×24 jam.
          </p>

          <div style={S.infoBox}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <div style={S.infoText}>
              Jika sudah lebih dari 24 jam belum ada konfirmasi, silakan hubungi admin daycare secara langsung.
            </div>
          </div>

          <button 
            style={{...S.btn, ...(hover ? S.btnHover : {})}}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={handleLogout}
          >
            Kembali ke Halaman Login
          </button>
        </div>
      </div>
    </>
  )
}

const S = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem', position: 'relative', overflow: 'hidden',
    background: '#FAFAFA',
  },
  circle: {
    position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0, opacity: 0.6
  },
  card: {
    position: 'relative', zIndex: 1,
    background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)',
    borderRadius: 24, padding: '3.5rem 2.5rem',
    width: '100%', maxWidth: '480px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  iconWrapper: {
    display: 'flex', justifyContent: 'center', marginBottom: '1.5rem',
    animation: 'float 4s ease-in-out infinite'
  },
  iconBg: {
    width: 80, height: 80, borderRadius: '50%',
    background: '#EFF6FF', border: '8px solid #fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
    animation: 'pulse-ring 2s infinite',
  },
  icon: { fontSize: '2.5rem' },
  title: { 
    margin: '0 0 1rem', fontSize: '1.8rem', fontWeight: 800, 
    background: 'linear-gradient(135deg, #1A3A6B, #3B82F6)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  tag: {
    display: 'inline-block', background: '#FEF3C7', color: '#B45309',
    padding: '0.4rem 1rem', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
    marginBottom: '1.5rem', border: '1px solid #FDE68A'
  },
  body: { 
    color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 1rem' 
  },
  infoBox: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16,
    padding: '1.25rem', marginTop: '1.5rem', marginBottom: '2rem', textAlign: 'left',
  },
  infoText: { fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, fontWeight: 500 },
  btn: {
    background: '#fff', border: '2px solid #E2E8F0',
    color: '#475569', borderRadius: 14, padding: '0.85rem 2rem',
    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
    width: '100%', transition: 'all 0.2s ease',
  },
  btnHover: {
    background: '#F1F5F9', borderColor: '#CBD5E1', color: '#1E293B',
    transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
  }
}
