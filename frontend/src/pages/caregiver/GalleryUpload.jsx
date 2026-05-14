import { useEffect, useRef, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'
import PageLayout from '../../components/layout/PageLayout'
import { useAuth } from '../../context/AuthContext'
import { Plus, X, Upload, Trash2, Camera, MapPin } from 'lucide-react'

const Avatar = ({ name, size = 44 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

const fmtTime = (dateStr) => {
  if (!dateStr) return '12:00'
  const d = new Date(dateStr)
  if (isNaN(d)) return '12:00'
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const fmtDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const cleanCaption = (caption) => {
  if (!caption) return 'Nama Aktivitas'
  // Hapus pola " (Lokasi: ...)" yang tersimpan otomatis di DB
  return caption.replace(/\s*\(Lokasi:.*?\)/gi, '').trim() || caption
}

export default function GalleryUpload() {
  const { profile }                       = useAuth()
  const [children, setChildren]           = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayAtt, setTodayAtt]           = useState(null)
  const [gallery, setGallery]             = useState([])
  const [showUpload, setShowUpload]       = useState(false)
  const [form, setForm]                   = useState({ child_id: '', caption: '', location: 'Daycare ABC, 1st Floor', activity_date: new Date().toISOString().split('T')[0] })
  const [file, setFile]                   = useState(null)
  const [preview, setPreview]             = useState(null)
  const [loading, setLoading]             = useState(false)
  const [lightbox, setLightbox]           = useState(null)
  const [showCamera, setShowCamera]       = useState(false)
  const videoRef                          = useRef(null)
  const canvasRef                         = useRef(null)
  const streamRef                         = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      setShowCamera(true) // render video element first, then attach in useEffect
    } catch (err) {
      toast.error('Gagal mengakses kamera. Mohon berikan izin kamera pada browser Anda.')
    }
  }

  // Attach stream ke video SETELAH elemen ter-render
  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [showCamera])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const f = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setFile(f)
      setPreview(URL.createObjectURL(f))
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  useEffect(() => {
    api.get('/api/v1/children/').then(r => {
      const list = r.data.data
      setChildren(list)
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) {
        setSelectedChild(defaultChild)
        setForm(f => ({ ...f, child_id: defaultChild.id }))
      }
    })
    loadGallery()
    return () => stopCamera() // Cleanup on unmount
  }, [])

  useEffect(() => {
    if (showUpload) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [showUpload])

  useEffect(() => {
    if (!selectedChild) return
    const today = new Date().toISOString().split('T')[0]
    api.get(`/api/v1/attendances/?child_id=${selectedChild.id}`)
      .then(r => setTodayAtt(r.data.data.find(a => a.date === today) ?? null))
  }, [selectedChild?.id])

  const loadGallery = () => api.get('/api/v1/galleries/').then(r => setGallery(r.data.data)).catch(console.error)

  const handleCloseModal = () => {
    stopCamera()
    setFile(null)
    setPreview(null)
    setShowUpload(false)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file || !form.child_id) { toast.error('Pilih anak dan foto terlebih dahulu'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('child_id', form.child_id)
    fd.append('caption', form.caption)
    fd.append('location', form.location)
    fd.append('activity_date', new Date().toISOString().split('T')[0]) // Ambil paksa tanggal real-time komputer untuk menghindari kebohongan tanggal
    try {
      await api.post('/api/v1/galleries/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Foto berhasil diunggah!')
      setForm(f => ({ ...f, caption: '' }))
      handleCloseModal()
      loadGallery()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal upload foto')
    }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus foto ini?')) return
    try { await api.delete(`/api/v1/galleries/${id}`); toast.success('Foto dihapus'); loadGallery() }
    catch { toast.error('Gagal menghapus') }
  }

  const filteredGallery = selectedChild
    ? gallery.filter(item => String(item.child_id) === String(selectedChild.id))
    : gallery

  return (
    <PageLayout>
      <div style={S.page}>

        {/* ── Header Card ── */}
        <div className="header-card" style={S.headerCard}>
          <div className="header-card-left" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Avatar name={selectedChild?.full_name} size={46} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                  {selectedChild?.full_name ?? 'Nama Anaku'}
                </span>
                {todayAtt?.check_in_at && !todayAtt?.check_out_at && (
                  <span style={S.badge}>Checked In</span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Orang Tua: {selectedChild?.parent?.full_name ?? '-'}
              </div>
            </div>
          </div>
          {/* Switch anak */}
          <select
            className="header-card-right"
            style={S.ubahBtn}
            value={selectedChild?.id ?? ''}
            onChange={e => {
              const child = children.find(c => c.id === e.target.value)
              if (child) {
                localStorage.setItem('selected_child_id', child.id)
                setSelectedChild(child)
                setForm(f => ({ ...f, child_id: child.id }))
              }
            }}
          >
            {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>

        {/* ── Gallery Grid ── */}
        <div className="dashboard-grid-3" style={S.grid}>
          {filteredGallery.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Belum ada foto untuk anak ini. Klik + untuk mengunggah.
            </div>
          )}
          {filteredGallery.map(item => (
            <div key={item.id} style={S.card} onClick={() => setLightbox(item)}>
              <div style={S.imgBox}>
                <img src={item.cloudinary_url} alt={item.caption} style={S.img} />
                <button
                  style={S.delBtn}
                  onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                  title="Hapus foto"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={S.cardBody}>
                <div style={S.cardTitle}>{cleanCaption(item.caption)}</div>
                
                {item.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--primary)', marginBottom: '0.3rem', fontWeight: 500 }}>
                    <MapPin size={12} />
                    <span>{item.location}</span>
                  </div>
                )}

                <div style={S.cardMeta}>
                  {fmtTime(item.created_at || item.activity_date)} | {fmtDate(item.created_at || item.activity_date)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── FAB Upload ── */}
        <button className="gallery-fab" style={S.fab} onClick={() => setShowUpload(true)} title="Upload foto">
          <Plus size={22} />
        </button>

        {/* ── Upload Modal ── */}
        {showUpload && !showCamera && (
          <div className="modal-overlay" style={S.overlay} onClick={handleCloseModal}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>Upload Foto Aktivitas</h3>
                <button type="button" style={S.closeBtn} onClick={handleCloseModal}><X size={18} /></button>
              </div>
              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
                {/* Photo Zone */}
                <div style={S.dropZone}>
                  {preview ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                      {/* Ulangi button */}
                      <button
                        type="button"
                        onClick={() => { setFile(null); setPreview(null) }}
                        style={{
                          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                          background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)',
                          borderRadius: 20, padding: '0.4rem 1.2rem', cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.85rem', backdropFilter: 'blur(4px)',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}
                      >
                        <Camera size={14} /> Ulangi
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem' }}>
                      <Camera size={36} color="var(--primary)" />
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                        Foto harus diambil langsung dari kamera<br/>untuk menjaga keaslian laporan.
                      </div>
                      <button
                        type="button"
                        onClick={startCamera}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          background: 'var(--primary)', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '0.65rem 1.75rem', cursor: 'pointer',
                          fontWeight: 700, fontSize: '0.95rem', marginTop: '0.25rem',
                        }}
                      >
                        <Camera size={18} /> Ambil Foto
                      </button>
                    </div>
                  )}
                </div>

                <div style={S.fld}>
                  <label style={S.lbl}>Anak</label>
                  <select style={S.inp} value={form.child_id} onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))} required>
                    <option value="">-- Pilih Anak --</option>
                    {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>Nama Aktivitas / Keterangan</label>
                  <input style={S.inp} placeholder="Misal: Bermain lego bersama teman" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>Lokasi</label>
                  <input style={S.inp} placeholder="Daycare ABC, 1st Floor" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <button type="submit" style={S.submitBtn} disabled={loading}>
                  {loading ? 'Mengunggah...' : 'Upload Foto'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Camera Overlay (fullscreen, iOS Modern Style) ── */}
        {showCamera && (
          <div style={{
            position: 'fixed', inset: 0, background: '#000', zIndex: 100000, // Prioritas mutlak di atas segalanya
          }}>
            {/* Live video feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Controls bar (Faint elegant shadow agar kamera terlihat 100% jernih dan jangkauan pandang maksimal) */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '2rem 2rem calc(1.5rem + env(safe-area-inset-bottom, 16px))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)',
            }}>
              {/* Cancel Button */}
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  position: 'absolute', left: '2rem',
                  background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '50%', width: 48, height: 48, color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(8px)', transition: 'all 0.15s', outline: 'none',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <X size={22} strokeWidth={2.5} />
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={capturePhoto}
                style={{
                  width: 76, height: 76, borderRadius: '50%',
                  background: '#fff', border: '6px solid rgba(255,255,255,0.35)',
                  cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  outline: 'none', transition: 'all 0.15s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
                onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
              />
            </div>

            {/* Hint Glass Badge */}
            <div style={{
              position: 'absolute', top: '2.5rem', left: '50%', transform: 'translateX(-50%)',
              color: '#fff', fontSize: '0.85rem', fontWeight: 600,
              background: 'rgba(0,0,0,0.55)', padding: '0.6rem 1.25rem', borderRadius: '30px',
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', textAlign: 'center'
            }}>
              Arahkan kamera & ketuk tombol
            </div>
          </div>
        )}

        {/* ── Lightbox ── */}
        {lightbox && (
          <div style={{ ...S.overlay, alignItems: 'center', justifyContent: 'center' }} onClick={() => setLightbox(null)}>
            <div style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
              <img src={lightbox.cloudinary_url} alt={lightbox.caption} style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              <div style={{ background: '#fff', padding: '1rem 1.25rem' }}>
                <div style={{ fontWeight: 600 }}>{cleanCaption(lightbox.caption)}</div>
                
                {lightbox.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                    <MapPin size={12} />
                    <span>{lightbox.location}</span>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {fmtTime(lightbox.created_at || lightbox.activity_date)} | {fmtDate(lightbox.created_at || lightbox.activity_date)}
                </div>
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
  page: { padding: '0', width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', minHeight: '100%' },

  headerCard: { background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', border: '1px solid #F8F9FA' },
  badge: { background: '#DCFCE7', color: '#16A34A', padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600 },
  ubahBtn: { background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: '#1E293B' },

  // Grid
  grid: { width: '100%' },
  card: { background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', transition: 'transform 0.2s ease', border: '1px solid #F8F9FA' },
  imgBox: { position: 'relative', width: '100%', paddingBottom: '65%', background: '#E2E8F0' },
  img: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  delBtn: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', opacity: 0 },
  cardBody: { padding: '0.75rem 0.9rem' },
  cardTitle: { fontWeight: 800, fontSize: '0.95rem', color: '#1E293B', marginBottom: '0.2rem' },
  cardMeta: { fontSize: '0.75rem', color: 'var(--text-muted)' },

  // FAB
  fab: { position: 'fixed', bottom: '2rem', right: '2rem', width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 100 },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' },
  modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: '480px', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid var(--border)' },
  closeBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: 6 },
  dropZone: { border: '1.5px dashed #CBD5E1', borderRadius: 10, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' },
  fld: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  lbl: { fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  inp: { border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.9rem', color: '#1E293B', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' },
  submitBtn: { background: '#60B8D4', border: 'none', borderRadius: 8, padding: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' },
}
