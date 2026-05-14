import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import PageLayout from '../../components/layout/PageLayout'
import ParentPageHeader from '../../components/layout/ParentPageHeader'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle, AlertCircle } from 'lucide-react'


const Avatar = ({ name, size = 50 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

const fmt12h = (isoStr) => {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return isoStr
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

export default function ParentBilling() {
  const { profile } = useAuth()
  const [children, setChildren]           = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayAtt, setTodayAtt]           = useState(null)
  const [billing, setBilling]             = useState(null)
  const [isLoading, setIsLoading]         = useState(true)

  // ── Fetch children ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      const list = r.data.data || []
      setChildren(list)
      if (list.length === 0) {
        setIsLoading(false)
        return
      }
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) setSelectedChild(defaultChild)
    }).catch(() => setIsLoading(false))
  }, [])

  // ── Fetch attendance and billing ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedChild) return
    setIsLoading(true)
    setTodayAtt(null)
    setBilling(null)
    
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const fetch = () => {
      Promise.all([
        api.get(`/api/v1/attendances/?child_id=${selectedChild.id}`),
        api.get(`/api/v1/billings/?child_id=${selectedChild.id}`)
      ]).then(([attRes, billRes]) => {
        setTodayAtt(attRes.data.data.find(a => a.date === today) ?? null)
        if (billRes.data.data && billRes.data.data.length > 0) {
          setBilling(billRes.data.data[0])
        } else {
          setBilling(null)
        }
      }).catch(() => {}).finally(() => {
        setIsLoading(false)
      })
    }
    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [selectedChild?.id])

  const formatRp = (num) => `Rp ${Number(num).toLocaleString('id-ID')}`


  return (
    <PageLayout>
      <div style={S.page}>

        {/* ── Consistent Page Header ── */}
        <ParentPageHeader
          selectedChild={selectedChild}
          children={children}
          todayAtt={todayAtt}
          onChildChange={setSelectedChild}
        />

        {/* ── Check In/Out Section ── */}
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Check In/Out Hari Ini</h3>

          <div style={S.checkRow}>
            {/* Check In Card */}
            <div style={{ 
              ...S.checkCard, 
              background: (todayAtt?.check_in_at && !todayAtt?.check_out_at) ? '#DCFCE7' : '#F4F4F5',
              borderColor: (todayAtt?.check_in_at && !todayAtt?.check_out_at) ? '#A7F3D0' : '#E5E7EB'
            }}>
              <div style={S.checkCardTop}>
                <div style={{ ...S.dot, background: (todayAtt?.check_in_at && !todayAtt?.check_out_at) ? '#15803D' : '#64748B' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: (todayAtt?.check_in_at && !todayAtt?.check_out_at) ? '#15803D' : '#64748B' }}>
                  Checking In
                </span>
              </div>
              <div style={{ ...S.checkTime, color: '#1E293B' }}>
                {todayAtt?.check_in_at ? fmt12h(todayAtt.check_in_at) : '—'}
              </div>
            </div>

            {/* Pick Up Card */}
            <div style={{ 
              ...S.checkCard, 
              background: todayAtt?.check_out_at ? '#FEE2E2' : '#F4F4F5',
              borderColor: todayAtt?.check_out_at ? '#FECACA' : '#E5E7EB'
            }}>
              <div style={S.checkCardTop}>
                <div style={{ ...S.dot, background: todayAtt?.check_out_at ? '#B91C1C' : '#64748B' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: todayAtt?.check_out_at ? '#B91C1C' : '#64748B' }}>
                  Pick Up
                </span>
              </div>
              <div style={{ ...S.checkTime, color: todayAtt?.check_out_at ? '#1E293B' : '#94A3B8' }}>
                {todayAtt?.check_out_at ? fmt12h(todayAtt.check_out_at) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── QR Code Section / Billing ── */}
        {isLoading ? (
          <div style={{ ...S.qrSection, padding: '3rem 1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', background: '#fff', borderRadius: 12, border: '1px solid var(--border)', marginTop: '2rem' }}>
             <div className="skeleton-shimmer" style={{ height: '36px', width: '60%', borderRadius: '8px' }} />
             <div className="skeleton-shimmer" style={{ height: '220px', width: '220px', borderRadius: '12px' }} />
             <div className="skeleton-shimmer" style={{ height: '42px', width: '45%', borderRadius: '20px' }} />
          </div>
        ) : billing ? (
          billing.status === 'paid' ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#ECFDF5', borderRadius: 12, border: '1px solid #A7F3D0', marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <CheckCircle size={48} color="#10B981" />
              </div>
              <h3 style={{ margin: 0, color: '#065F46', fontSize: '1.4rem', fontWeight: 800 }}>Tagihan Lunas!</h3>
              <p style={{ margin: '0.5rem 0 0', color: '#047857', fontSize: '1rem' }}>Terima kasih, pembayaran sebesar <strong>{formatRp(billing.total_amount)}</strong> telah dikonfirmasi oleh Admin.</p>
            </div>
          ) : (
            <div style={S.qrSection}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#1E293B' }}>{formatRp(billing.total_amount)}</h2>
                <p style={{ color: '#64748B', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Silakan scan QRIS di bawah ini untuk melakukan pembayaran.</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <img 
                  src="https://res.cloudinary.com/df727q6z3/image/upload/v1735156125/qris-dummy_mscq9h.png" 
                  alt="QRIS QR Code" 
                  style={{ width: '100%', maxWidth: '260px', height: 'auto' }}
                />
              </div>

              <div style={{ marginTop: '1.5rem', background: '#EFF6FF', padding: '1rem', borderRadius: '12px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                <AlertCircle size={20} color="#3B82F6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, color: '#1E40AF', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  Sistem akan secara otomatis memproses pembayaran setelah Anda mentransfer sesuai jumlah di atas. Silakan hubungi Admin jika ada kendala.
                </p>
              </div>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1', marginTop: '2rem' }}>
            <h3 style={{ margin: 0, color: '#475569', fontSize: '1.1rem' }}>Belum ada tagihan</h3>
            <p style={{ margin: '0.5rem 0 0', color: '#94A3B8', fontSize: '0.9rem' }}>Selesaikan Check Out untuk memunculkan tagihan, atau tunggu Admin menerbitkan invoice.</p>
          </div>
        )}

      </div>
    </PageLayout>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    padding: '0 0 2rem 0', // Added bottom breathing room
    minHeight: '100%', // Allow growth beyond viewport if content overflows
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  section: {
    background: '#FFFFFF',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  sectionTitle: {
    margin: '0 0 1rem 0',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#1E293B',
  },
  checkRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  checkCard: {
    borderRadius: 12,
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: '#E5E7EB'
  },
  checkCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  checkTime: {
    fontWeight: 800,
    fontSize: '1.6rem',
    letterSpacing: '-0.5px',
  },
  qrSection: {
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA',
    padding: '2.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1, // Grow to fill rest of available space
  },
  qrCard: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '1.5rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #F1F5F9',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  },
}
