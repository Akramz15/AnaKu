import { useEffect, useRef, useState } from 'react'
import { X, Save, ImagePlus, HelpCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/axios'
import toast from 'react-hot-toast'

/**
 * EditProfileModal
 * Props:
 *   - isOpen    : boolean
 *   - onClose   : () => void
 *   - childData : { id, full_name, birth_date } | null  (anak yang sedang dipilih)
 */
export default function EditProfileModal({ isOpen, onClose, childData }) {
  const { profile, refreshProfile } = useAuth()
  const fileInputRef = useRef(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [childName, setChildName]   = useState('')
  const [childAge, setChildAge]     = useState('')
  const [parentName, setParentName] = useState('')
  const [email, setEmail]           = useState('')
  const [phone, setPhone]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  // ── Prefill from context + props ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setParentName(profile?.full_name ?? '')
    setEmail(profile?.email ?? '')
    setPhone(profile?.phone ?? '')
    setAvatarFile(null)
    setAvatarPreview(null)

    if (childData) {
      setChildName(childData.full_name ?? '')
      if (childData.birth_date) {
        const age = Math.floor((Date.now() - new Date(childData.birth_date)) / (365.25 * 86400000))
        setChildAge(`${age} Tahun`)
      } else {
        setChildAge('')
      }
    } else {
      setChildName('')
      setChildAge('')
    }
  }, [isOpen, profile, childData])

  // ── Handle file pick ───────────────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const onDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Update parent profile (name, phone)
      await api.put('/api/v1/users/me', { full_name: parentName, phone })
      
      // 2. Upload avatar if selected
      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)
        
        // Upload untuk parent
        await api.post('/api/v1/users/me/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        // Upload untuk anak (agar tampil di dashboard header)
        if (childData) {
          await api.post(`/api/v1/children/${childData.id}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        }
      }

      // 3. Update child name if changed
      if (childData && childName && childName !== childData.full_name) {
        await api.put(`/api/v1/children/${childData.id}`, { full_name: childName })
      }

      await refreshProfile()
      toast.success('Profil berhasil disimpan!')
      onClose()
      
      // Reload page to reflect child changes across the app
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error(error)
      toast.error('Gagal menyimpan profil.')
    } finally {
      setSaving(false)
    }
  }

  // ── Keyboard ESC to close ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Edit Profil</h2>
            <p style={S.subtitle}>Ubah profil</p>
          </div>
          <button style={S.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* ── Photo Upload ── */}
        <div
          style={S.uploadZone}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
        >
          <div style={S.uploadIcon}>
            {avatarPreview
              ? <img src={avatarPreview} alt="preview" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
              : <ImagePlus size={24} color="var(--text-muted)" />
            }
          </div>
          <div style={S.uploadText}>
            <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.88rem' }}>Click to upload</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}> or drag and drop</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              SVG, PNG, JPG or GIF (max. 800×400px)
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {/* ── Form Fields ── */}
        <div style={S.form}>
          <Field 
            label="Nama Anak" 
            value={childName} 
            onChange={(val) => {
              if (!childData) {
                toast.error('Pilih anak atau daftar dulu ke admin')
                return
              }
              setChildName(val)
            }} 
            placeholder="Nama anak" 
          />
          <Field 
            label="Usia" 
            value={childAge} 
            onChange={(val) => {
              if (!childData) {
                toast.error('Pilih anak atau daftar dulu ke admin')
                return
              }
              setChildAge(val)
            }} 
            placeholder="Contoh: 5 Tahun" 
          />
          <Field label="Nama Orang Tua" value={parentName} onChange={setParentName} placeholder="Nama orang tua" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="email@gmail.com" icon={<HelpCircle size={16} color="#CBD5E1" />} disabled />
          <Field label="No Telp" value={phone} onChange={setPhone} placeholder="081234567890" icon={<HelpCircle size={16} color="#CBD5E1" />} />
        </div>

        {/* ── Save Button ── */}
        <button style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>

      </div>
    </div>
  )
}

// ── Reusable field ─────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, icon, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.6rem 0.9rem',
            fontSize: '0.9rem',
            color: disabled ? 'var(--text-muted)' : 'var(--text)',
            outline: 'none',
            background: disabled ? '#F9FAFB' : '#fff',
            paddingRight: icon ? '2.5rem' : '0.9rem',
            boxSizing: 'border-box',
          }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {icon && (
          <div style={{ position: 'absolute', right: '0.75rem', pointerEvents: 'none' }}>{icon}</div>
        )}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '1rem',
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: '480px',
    padding: '2rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    maxHeight: '95vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontWeight: 700,
    fontSize: '1.2rem',
    color: '#1E293B',
  },
  subtitle: {
    margin: '0.2rem 0 0',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    padding: '0.2rem',
    borderRadius: 6,
    marginTop: '0.1rem',
  },
  uploadZone: {
    border: '1.5px dashed var(--border)',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  uploadIcon: {
    width: 48, height: 48,
    background: '#F4F4F5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  uploadText: {
    display: 'flex',
    flexDirection: 'column',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  saveBtn: {
    background: '#6EC6C6',
    border: 'none',
    borderRadius: 10,
    padding: '0.85rem',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '0.25rem',
    transition: 'opacity 0.2s',
  },
}
