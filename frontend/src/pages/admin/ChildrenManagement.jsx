import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import PageLayout from '../../components/layout/PageLayout'
import toast from 'react-hot-toast'
import { Pencil, Trash2, ClipboardList } from 'lucide-react'

export default function ChildrenManagement() {
  const [children, setChildren] = useState([])
  const [parents, setParents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '', birth_date: '', gender: 'male', parent_id: '', notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [resChild, resUsers] = await Promise.all([
        api.get('/api/v1/children/'),
        api.get('/api/v1/users/?role=parent&status=active') // Hanya orang tua yang sudah diverifikasi
      ])
      setChildren(resChild.data.data)
      setParents(resUsers.data.data)
    } catch (err) {
      console.error(err)
      toast.error("Gagal mengambil data: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/v1/children', form)
      toast.success('Data anak berhasil ditambahkan!')
      setShowModal(false)
      setForm({ full_name: '', birth_date: '', gender: 'male', parent_id: '', notes: '' })
      fetchData()
    } catch (err) {
      toast.error('Gagal menambah data')
    } finally {
      setLoading(false)
    }
  }

  const getAgeGroup = (birthDate) => {
    if (!birthDate) return '-'
    const age = Math.floor((new Date() - new Date(birthDate)) / (365.25 * 86400000))
    if (age < 1) return 'Bayi'
    if (age <= 3) return 'Batita'
    return 'Balita'
  }

  const getStatus = (att) => {
    if (!att) return 'Active'
    if (att.check_in_at && !att.check_out_at) return 'Checked In'
    if (att.check_out_at) return 'Checked Out'
    return 'Active'
  }

  const handleStatusChange = async (childId, newStatus) => {
    try {
      await api.post('/api/v1/attendances', { child_id: childId, status: newStatus })
      toast.success('Status berhasil diubah!')
      fetchData()
    } catch (err) {
      toast.error('Gagal mengubah status')
    }
  }

  const handleDelete = async (id) => {
    if(!confirm('Hapus data anak ini?')) return
    try {
      await api.delete(`/api/v1/children/${id}`)
      toast.success('Data terhapus')
      fetchData()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  return (
    <PageLayout>
      <div style={S.page}>
        <div className="header-card" style={{...S.header, flexWrap: 'wrap'}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={S.title}>Daftar Anak</h1>
            <span style={S.userCount}>{children.length} anak</span>
          </div>
          <button style={S.addBtn} onClick={() => setShowModal(true)}>+</button>
        </div>

        <div className="table-responsive" style={S.tableContainer}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Name</th>
                <th style={S.th}>Kelompok Usia</th>
                <th style={S.th}>Nama Orang Tua</th>
                <th style={S.th}>No Telepon</th>
                <th style={S.th}>Email address</th>
                <th style={S.th}>Status</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {children.map(child => {
                const status = getStatus(child.today_attendance)
                return (
                  <tr key={child.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: '0.2rem' }}>{child.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>@{child.full_name.split(' ')[0].toLowerCase()}</div>
                    </td>
                    <td style={S.td}>{getAgeGroup(child.birth_date)}</td>
                    <td style={S.td}>{child.parent?.full_name || '-'}</td>
                    <td style={S.td}>{child.parent?.phone || '-'}</td>
                    <td style={S.td}>{child.parent?.email || '-'}</td>
                    <td style={S.td}>
                      <select 
                        style={{ ...S.statusSelect, 
                          background: status === 'Checked In' ? '#ECFDF5' : status === 'Checked Out' ? '#FEF2F2' : '#F0FDF4',
                          color: status === 'Checked In' ? '#10B981' : status === 'Checked Out' ? '#EF4444' : '#22C55E'
                        }}
                        value={status}
                        onChange={(e) => handleStatusChange(child.id, e.target.value)}
                      >
                        <option value="Active">Active</option>
                        <option value="Checked In">Checked In</option>
                        <option value="Checked Out">Checked Out</option>
                      </select>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <button style={S.actionBtn}><Pencil size={18} /></button>
                      <button style={S.actionBtn} onClick={() => handleDelete(child.id)}><Trash2 size={18} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={S.pagination}>
          <button style={S.pageBtn}>Previous</button>
          <div style={S.pageNumbers}>
            <span style={S.pageActive}>1</span>
            <span style={S.pageNum}>2</span>
            <span style={S.pageNum}>3</span>
            <span style={S.pageNum}>...</span>
            <span style={S.pageNum}>8</span>
            <span style={S.pageNum}>9</span>
            <span style={S.pageNum}>10</span>
          </div>
          <button style={S.pageBtn}>Next</button>
        </div>

        {showModal && (
          <div style={S.overlay}>
            <div style={S.modal}>
              <div style={S.modalHeader}>
                <div style={S.modalIconBox}>
                  <ClipboardList size={20} color="#334155" />
                </div>
                <button style={S.closeBtn} onClick={() => setShowModal(false)}>&times;</button>
              </div>
              
              <h2 style={S.modalTitle}>Tambahkan Anggota Baru</h2>
              <p style={S.modalSubtitle}>Masukkan data profil anak ke dalam sistem</p>

              <form onSubmit={handleSubmit} style={S.form}>
                <div style={S.field}>
                  <label style={S.label}>Nama Anak</label>
                  <input style={S.input} placeholder="Nama Anaku" required
                    value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </div>

                <div style={S.field}>
                  <label style={S.label}>Tanggal Lahir</label>
                  <input style={S.input} type="date" required
                    value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
                </div>

                <div style={S.field}>
                  <label style={S.label}>Jenis Kelamin</label>
                  <select style={S.input} value={form.gender}
                    onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                </div>

                <div style={S.field}>
                  <label style={S.label}>Nama Orang Tua</label>
                  <select style={S.input} required value={form.parent_id}
                    onChange={e => setForm({ ...form, parent_id: e.target.value })}>
                    <option value="">Pilih Orangtua/wali</option>
                    {parents.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>

                <div style={S.field}>
                  <label style={S.label}>Catatan Tambahan</label>
                  <input style={S.input} placeholder="Catatan (Alergi, dll)"
                    value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                
                <button type="submit" style={S.saveBtn} disabled={loading}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    💾 {loading ? 'Menyimpan...' : 'Simpan'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

const S = {
  page: { 
    padding: '1.5rem', 
    width: '100%', 
    boxSizing: 'border-box',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #F8F9FA',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', margin: 0 },
  userCount: { background: '#E0F2FE', color: '#0369A1', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600 },
  addBtn: { background: '#fff', border: '1px solid #E2E8F0', width: 36, height: 36, borderRadius: '50%', fontSize: '1.2rem', color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  
  tableContainer: { overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' },
  th: { padding: '1rem 0.5rem', borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', fontWeight: 600, color: '#64748B', background: '#FFFFFF' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '1.2rem 0.5rem', fontSize: '0.9rem', color: '#334155', verticalAlign: 'middle' },
  
  statusSelect: { padding: '0.3rem 0.6rem', borderRadius: 20, border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', outline: 'none' },
  actionBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem', marginLeft: '0.5rem' },
  
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '1rem 0 0', borderTop: '1px solid #F1F5F9' },
  pageBtn: { padding: '0.5rem 1rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  pageNumbers: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  pageNum: { fontSize: '0.85rem', color: '#475569', cursor: 'pointer', padding: '0.3rem 0.6rem', borderRadius: 6 },
  pageActive: { fontSize: '0.85rem', color: '#1E293B', background: '#F1F5F9', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: 6 },
  
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', padding: '2rem', borderRadius: 16, width: '100%', maxWidth: '480px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  modalIconBox: { width: 44, height: 44, borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#64748B', cursor: 'pointer', padding: 0, lineHeight: 1 },
  modalTitle: { margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' },
  modalSubtitle: { margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#64748B' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.85rem', fontWeight: 600, color: '#334155' },
  input: { padding: '0.75rem 1rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', color: '#334155', background: '#fff' },
  saveBtn: { padding: '0.85rem', background: '#93C5C4', color: '#1E293B', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', marginTop: '1rem', display: 'flex', justifyContent: 'center' },
}
