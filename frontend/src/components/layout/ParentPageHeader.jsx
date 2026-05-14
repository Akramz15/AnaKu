/**
 * ParentPageHeader
 * Komponen header konsisten untuk semua halaman parent.
 * Termasuk: Avatar anak, nama, badge, tombol Edit Profil (buka modal), dropdown Switch anak.
 *
 * Props:
 *   selectedChild  – objek anak yang dipilih
 *   children       – list semua anak
 *   todayAtt       – data absensi hari ini (untuk badge Checked In)
 *   onChildChange  – (child) => void  saat dropdown berubah
 */
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Pencil, ChevronDown } from 'lucide-react'
import EditProfileModal from '../EditProfileModal'

const Avatar = ({ name, photo_url, size = 50 }) => (
  photo_url ? (
    <img src={photo_url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
      {name ? name[0].toUpperCase() : '?'}
    </div>
  )
)

export default function ParentPageHeader({ selectedChild, children = [], todayAtt, onChildChange }) {
  const { profile } = useAuth()
  const [showEdit, setShowEdit] = useState(false)

  return (
    <>
      <div className="header-card" style={S.headerCard}>
        <div className="header-card-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Avatar name={selectedChild?.full_name} photo_url={selectedChild?.photo_url} size={50} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem' }}>
                {selectedChild?.full_name ?? 'Nama AnaKu'}
              </h2>
              {todayAtt?.check_in_at && <span style={S.badgeGreen}>Checked In</span>}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {profile?.full_name ?? 'Nama Orang Tua'}
            </p>
          </div>
        </div>

        <div className="header-card-right" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Edit Profil Button → buka modal */}
          <button style={S.outlineBtn} onClick={() => setShowEdit(true)}>
            Edit Profil <Pencil size={14} />
          </button>

          {/* Switch anak */}
          <select
            style={S.outlineBtn}
            value={selectedChild?.id ?? ''}
            onChange={e => {
              const child = children.find(c => c.id === e.target.value)
              if (child) {
                localStorage.setItem('selected_child_id', child.id)
                if (onChildChange) onChildChange(child)
              }
            }}
          >
            {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        childData={selectedChild}
      />
    </>
  )
}

const S = {
  headerCard: {
    background: '#FFFFFF',
    padding: '1.25rem 1.5rem',
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    flexShrink: 0
  },
  badgeGreen: { 
    background: '#DCFCE7', color: '#15803D', 
    padding: '0.25rem 0.6rem', borderRadius: '12px', 
    fontSize: '0.7rem', fontWeight: 700 
  },
  outlineBtn: { 
    background: 'transparent', border: '1px solid #E2E8F0', 
    padding: '0.5rem 1rem', borderRadius: '10px', 
    cursor: 'pointer', fontWeight: 600, color: '#1E293B', 
    fontSize: '0.8rem', outline: 'none',
    display: 'flex', alignItems: 'center', gap: '0.5rem'
  },
}
