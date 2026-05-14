import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import PageLayout from '../../components/layout/PageLayout'
import toast from 'react-hot-toast'
import { Check, X, Clock, UserCheck, UserX, UserMinus } from 'lucide-react'

const TABS = [
  { key: 'pending',  label: 'Menunggu',  icon: <Clock size={15} /> },
  { key: 'active',   label: 'Disetujui', icon: <UserCheck size={15} /> },
  { key: 'rejected', label: 'Ditolak',   icon: <UserX size={15} /> },
]

const STATUS_BADGE = {
  pending:  { bg: '#FEF9C3', color: '#854D0E', label: 'Menunggu' },
  active:   { bg: '#DCFCE7', color: '#166534', label: 'Aktif' },
  rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Ditolak' },
}

const fmt = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function RegistrationManagement() {
  const [tab, setTab]             = useState('pending')
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  // Modal reject
  const [rejectModal, setRejectModal] = useState(null) // { id, name }
  const [reason, setReason]       = useState('')
  const [actionLoad, setActionLoad] = useState(null)

  const load = async (status) => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/registrations/?status=${status}`)
      setData(res.data.data)
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  const loadCount = async () => {
    try {
      const res = await api.get('/api/v1/registrations/count')
      setPendingCount(res.data.count)
    } catch {}
  }

  useEffect(() => { load(tab); loadCount() }, [tab])

  const handleApprove = async (id, name) => {
    if (!window.confirm(`Setujui akun "${name}"?`)) return
    setActionLoad(id + '_approve')
    try {
      await api.post(`/api/v1/registrations/${id}/approve`)
      toast.success(`Akun ${name} berhasil diaktifkan!`)
      load(tab); loadCount()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menyetujui')
    } finally { setActionLoad(null) }
  }

  const openReject = (id, name) => { setRejectModal({ id, name }); setReason('') }
  const closeReject = () => { setRejectModal(null); setReason('') }

  const handleReject = async () => {
    const { id, name } = rejectModal
    setActionLoad(id + '_reject')
    try {
      await api.post(`/api/v1/registrations/${id}/reject`, { reason: reason || 'Tidak memenuhi syarat' })
      toast.success(`Pendaftaran ${name} ditolak`)
      closeReject(); load(tab); loadCount()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menolak')
    } finally { setActionLoad(null) }
  }

  return (
    <PageLayout>
      <div style={S.page}>
        <div className="header-card" style={{...S.header, flexWrap: 'wrap'}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={S.pageTitle}>Persetujuan Akun</h1>
            {pendingCount > 0 && (
              <span style={S.countBadge}>{pendingCount} Menunggu</span>
            )}
          </div>
        </div>
          {/* Tabs */}
          <div style={S.tabBar}>
            {TABS.map(t => (
              <button
                key={t.key}
                style={{ ...S.tabBtn, ...(tab === t.key ? S.tabActive : {}) }}
                onClick={() => setTab(t.key)}
              >
                {t.icon}
                {t.label}
                {t.key === 'pending' && pendingCount > 0 && (
                  <span style={S.tabBadge}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="table-responsive" style={S.tableWrap}>
            {loading ? (
              <div style={S.empty}>Memuat data...</div>
            ) : data.length === 0 ? (
              <div style={S.empty}>Tidak ada data untuk tab ini.</div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Nama', 'No. Telepon', 'Email', 'Tanggal Daftar', 'Status', 'Aksi'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const badge = STATUS_BADGE[row.status] || STATUS_BADGE.pending
                    return (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: '#1E293B' }}>{row.full_name || '—'}</div>
                        </td>
                        <td style={S.td}>{row.phone || '—'}</td>
                        <td style={S.td}>{row.email || '—'}</td>
                        <td style={S.td}>{fmt(row.created_at)}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={S.td}>
                          {row.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                style={S.approveBtn}
                                onClick={() => handleApprove(row.id, row.full_name)}
                                disabled={actionLoad === row.id + '_approve'}
                                title="Setujui"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                style={S.rejectBtn}
                                onClick={() => openReject(row.id, row.full_name)}
                                disabled={actionLoad === row.id + '_reject'}
                                title="Tolak"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          )}
                          {row.status === 'rejected' && row.rejection_reason && (
                            <span style={{ fontSize: '0.78rem', color: '#991B1B' }}>
                              {row.rejection_reason}
                            </span>
                          )}
                          {row.status === 'active' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between', width: '100%' }}>
                              <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>Disetujui {fmt(row.approved_at)}</span>
                              <button
                                style={{ ...S.rejectBtn, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: 6, marginLeft: 'auto' }}
                                onClick={() => openReject(row.id, row.full_name)}
                                title="Nonaktifkan Akun"
                              >
                                <UserMinus size={13} /> Nonaktifkan
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div style={S.modalBg} onClick={closeReject}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.25rem', fontWeight: 800, color: tab === 'active' ? '#991B1B' : '#1E293B' }}>
              {tab === 'active' ? 'Nonaktifkan Akun' : 'Tolak Pendaftaran'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748B', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              {tab === 'active' 
                ? <>Anda akan menonaktifkan akses untuk akun <strong>{rejectModal.name}</strong>. Pengguna tidak akan bisa login kembali.</>
                : <>Anda akan menolak akun <strong>{rejectModal.name}</strong>.</>
              }
            </p>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
              Alasan {tab === 'active' ? 'Penonaktifan' : 'Penolakan'} (Opsional)
            </label>
            <textarea
              style={S.textarea}
              placeholder={tab === 'active' ? "Contoh: Berhenti berlangganan / Penyalahgunaan akun" : "Contoh: Data tidak lengkap / Anak tidak terdaftar"}
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button style={S.cancelBtn} onClick={closeReject}>Batal</button>
              <button
                style={{ ...S.confirmRejectBtn, background: tab === 'active' ? '#B91C1C' : '#DC2626' }}
                onClick={handleReject}
                disabled={!!actionLoad}
              >
                {actionLoad ? 'Memproses...' : (tab === 'active' ? 'Konfirmasi Nonaktifkan' : 'Konfirmasi Tolak')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = {
  page: { 
    padding: '1.5rem', 
    boxSizing: 'border-box', 
    width: '100%',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #F8F9FA',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '2rem' 
  },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', margin: 0 },
  pageSubtitle: { margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748B' },
  countBadge: {
    background: '#E0F2FE', color: '#0369A1', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600
  },
  tabBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: '#F8FAFC', borderStyle: 'solid', borderWidth: '1px', borderColor: '#E2E8F0',
    borderRadius: 12, padding: '0.6rem 1.25rem', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.85rem', color: '#64748B',
    position: 'relative', transition: 'all 0.2s'
  },
  tabActive: { background: '#1E293B', color: '#fff', borderColor: '#1E293B' },
  tabBadge: {
    background: '#EF4444', color: '#fff', borderRadius: 20,
    fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', marginLeft: '0.25rem'
  },
  tableWrap: { overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', flex: 1, minHeight: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th: {
    padding: '0.9rem 1rem', textAlign: 'left', fontSize: '0.82rem',
    fontWeight: 600, color: 'var(--text-muted)', background: '#F8FAFC',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.85rem 1rem', fontSize: '0.88rem', color: 'var(--text)', borderBottom: '1px solid var(--border)' },
  badge: { padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 },
  approveBtn: {
    background: '#DCFCE7', color: '#166534', border: 'none', borderRadius: 8,
    padding: '0.4rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  rejectBtn: {
    background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 8,
    padding: '0.4rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  empty: { padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' },
  // Modal
  modalBg: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '1rem',
  },
  modalBox: {
    background: '#fff', borderRadius: 16, padding: '1.75rem',
    width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  textarea: {
    width: '100%', marginTop: '0.4rem', padding: '0.75rem',
    border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: '0.9rem',
    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
    background: '#F8FAFC', color: '#334155',
  },
  cancelBtn: {
    flex: 1, padding: '0.75rem', background: 'transparent',
    border: '1.5px solid #E2E8F0', borderRadius: 10, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem', color: '#64748B',
  },
  confirmRejectBtn: {
    flex: 1, padding: '0.75rem', background: '#DC2626',
    border: 'none', borderRadius: 10, cursor: 'pointer',
    fontWeight: 700, fontSize: '0.9rem', color: '#fff',
  },
}
