import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import PageLayout from '../../components/layout/PageLayout'
import ParentPageHeader from '../../components/layout/ParentPageHeader'
import { useAuth } from '../../context/AuthContext'
import { Camera, MapPin } from 'lucide-react'

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 50 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

// ─── Format jam dari activity_date ────────────────────────────────────────────
const formatTime = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Hapus suffix lokasi yang tidak perlu dari caption ────────────────────────
const cleanCaption = (caption) => {
  if (!caption) return 'Nama Aktivitas'
  // Hapus pola " (Lokasi: ...)" yang kadang tersimpan di DB
  return caption.replace(/\s*\(Lokasi:.*?\)/gi, '').trim() || caption
}

export default function ParentGallery() {
  const { profile } = useAuth()
  const [children, setChildren]           = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayAtt, setTodayAtt]           = useState(null)
  const [gallery, setGallery]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [lightbox, setLightbox]           = useState(null)

  // ── Fetch children (filtered per parent by backend) ───────────────────────
  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      const list = r.data.data || []
      setChildren(list)
      if (list.length === 0) {
        setLoading(false)
        return
      }
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) setSelectedChild(defaultChild)
    }).catch(() => setLoading(false))
  }, [])

  // ── Fetch gallery + attendance when child changes ─────────────────────────
  useEffect(() => {
    if (!selectedChild) return
    setGallery([])
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]
    const cid   = selectedChild.id

    Promise.all([
      api.get(`/api/v1/galleries/?child_id=${cid}`),
      api.get(`/api/v1/attendances/?child_id=${cid}`),
    ]).then(([galRes, attRes]) => {
      setGallery(galRes.data.data)
      setTodayAtt(attRes.data.data.find(a => a.date === today) ?? null)
    }).finally(() => setLoading(false))
  }, [selectedChild?.id])

  return (
    <PageLayout>
      <div style={S.page}>

        {/* ── Header ── */}
        <ParentPageHeader
          selectedChild={selectedChild}
          children={children}
          todayAtt={todayAtt}
          onChildChange={setSelectedChild}
        />

        {/* ── Gallery Grid ── */}
        {loading ? (
          <div className="dashboard-grid-3" style={S.grid}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ ...S.card, cursor: 'default' }}>
                <div className="skeleton-shimmer" style={{ width: '100%', height: '220px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }} />
                <div style={S.cardBody}>
                  <div className="skeleton-shimmer" style={{ height: '18px', width: '70%', marginBottom: '0.5rem' }} />
                  <div className="skeleton-shimmer" style={{ height: '12px', width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : gallery.length === 0 ? (
          <div style={S.emptyState}>
            <Camera size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ margin: 0, color: 'var(--text)' }}>Belum ada foto</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Pengasuh belum mengunggah foto apa pun untuk {selectedChild?.full_name}.
            </p>
          </div>
        ) : (
          <div className="dashboard-grid-3" style={S.grid}>
            {gallery.map(item => (
              <div
                key={item.id}
                style={S.card}
                onClick={() => setLightbox(item)}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {/* Photo */}
                <div style={S.imgWrapper}>
                  <img
                    src={item.cloudinary_url}
                    alt={item.caption ?? 'Foto aktivitas'}
                    style={S.img}
                    loading="lazy"
                  />
                </div>
                {/* Caption below */}
                <div style={S.cardBody}>
                  <div style={S.cardTitle}>{cleanCaption(item.caption)}</div>
                  
                  {item.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--primary)', marginBottom: '0.3rem', fontWeight: 500 }}>
                      <MapPin size={12} />
                      <span>{item.location}</span>
                    </div>
                  )}

                  <div style={S.cardMeta}>
                    {formatTime(item.activity_date || item.created_at)} | {formatDate(item.activity_date || item.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Lightbox Modal ── */}
        {lightbox && (
          <div style={S.lightboxBg} onClick={() => setLightbox(null)}>
            <div style={S.lightboxBox} onClick={e => e.stopPropagation()}>
              {/* Photo full-width, rounded corners */}
              <div style={S.lbImgWrap}>
                <img
                  src={lightbox.cloudinary_url ?? lightbox.media_url}
                  alt={lightbox.caption ?? 'Foto aktivitas'}
                  style={S.lbImg}
                />
              </div>

              {/* Caption + meta */}
              <div style={S.lbBody}>
                <div style={S.lbTitle}>{cleanCaption(lightbox.caption)}</div>
                
                {lightbox.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    <MapPin size={12} />
                    <span>{lightbox.location}</span>
                  </div>
                )}

                <div style={S.lbMeta}>
                  {formatTime(lightbox.activity_date ?? lightbox.created_at)} | {formatDate(lightbox.activity_date ?? lightbox.created_at)}
                </div>
              </div>

              {/* Kembali button */}
              <div style={S.lbFooter}>
                <button style={S.kembaliBtn} onClick={() => setLightbox(null)}>
                  Kembali
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    padding: '0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  grid: {
    width: '100%',
    paddingBottom: '2rem',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '16px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #F8F9FA'
  },
  imgWrapper: {
    width: '100%',
    aspectRatio: '4/3',
    overflow: 'hidden',
    flexShrink: 0,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'transform 0.3s ease',
  },
  cardBody: {
    padding: '1rem 1.25rem',
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#1E293B',
    marginBottom: '0.25rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    fontSize: '0.8rem',
    color: '#64748B',
  },
  emptyState: {
    textAlign: 'center',
    padding: '4rem 2rem',
    background: '#FFFFFF',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  lightboxBg: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1.5rem',
  },
  lightboxBox: {
    background: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: '460px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  lbImgWrap: {
    width: '100%',
    padding: '1rem 1rem 0',
    boxSizing: 'border-box',
  },
  lbImg: {
    width: '100%',
    borderRadius: 16,
    display: 'block',
    objectFit: 'cover',
    maxHeight: '55vh',
  },
  lbBody: {
    padding: '1.25rem 1.5rem 0.5rem',
  },
  lbTitle: {
    fontWeight: 800,
    fontSize: '1.2rem',
    color: '#1E293B',
    marginBottom: '0.3rem',
  },
  lbMeta: {
    fontSize: '0.82rem',
    color: '#64748B',
    fontWeight: 400,
  },
  lbFooter: {
    padding: '1rem 1.5rem 1.5rem',
  },
  kembaliBtn: {
    width: '100%',
    padding: '0.85rem',
    background: 'var(--accent, #84D6FE)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    letterSpacing: '0.3px',
  },
}
