import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'
import PageLayout from '../../components/layout/PageLayout'
import { CheckCircle, XCircle, Trash2 } from 'lucide-react'

const STATUS_COLOR = { paid:'#ECFDF5', unpaid:'#FEF3C7', overdue:'#FEF2F2' }
const TEXT_COLOR = { paid:'#10B981', unpaid:'#D97706', overdue:'#EF4444' }
const STATUS_LABEL = { paid:'Lunas', unpaid:'Belum Bayar', overdue:'Terlambat' }
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const fmtDate = (isoStr) => {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BillingManagement() {
  const [billings, setBillings] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const b = await api.get('/api/v1/billings/')
      setBillings(b.data.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id) => {
    try {
      await api.patch(`/api/v1/billings/${id}`, { status:'paid' })
      toast.success('Tagihan ditandai lunas')
      load()
    } catch (e) {
      toast.error('Gagal memperbarui status')
    }
  }

  const handleDelete = async (id) => {
    if(!window.confirm('Hapus tagihan ini?')) return
    try {
      await api.delete(`/api/v1/billings/${id}`)
      toast.success('Tagihan dihapus')
      load()
    } catch(e) {
      toast.error('Gagal menghapus')
    }
  }

  const formatRp = (num) => `Rp ${Number(num).toLocaleString('id-ID')}`

  return (
    <PageLayout>
      <div style={S.page}>
        <div className="header-card" style={{...S.header, flexWrap: 'wrap'}}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap: 'wrap' }}>
            <h2 style={S.title}>Manajemen Pembayaran</h2>
            <span style={S.badgeCount}>{billings.length} data</span>
          </div>
        </div>

        <div className="table-responsive" style={S.tableContainer}>
          {loading ? (
            <div style={{ padding: '2rem', color: '#64748B' }}>Memuat data...</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Nama Anak</th>
                  <th style={S.th}>Orang Tua</th>
                  <th style={S.th}>Periode</th>
                  <th style={S.th}>Total (Rp)</th>
                  <th style={S.th}>Status</th>
                  <th style={{...S.th, textAlign:'right'}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {billings.map(b => (
                  <tr key={b.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#1E293B', marginBottom:'0.2rem' }}>{b.children?.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>@{b.children?.full_name.split(' ')[0].toLowerCase()}</div>
                    </td>
                    <td style={S.td}>{b.children?.parent?.full_name || '-'}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{MONTHS[b.period_month-1]} {b.period_year}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
                        {b.status === 'paid' ? `Lunas: ${fmtDate(b.paid_at)}` : `Terbit: ${fmtDate(b.created_at)}`}
                      </div>
                    </td>
                    <td style={{...S.td, fontWeight:600, color:'#1E293B'}}>{formatRp(b.total_amount)}</td>
                    <td style={S.td}>
                      <span style={{ 
                        padding: '0.3rem 0.6rem', borderRadius: 20, 
                        fontSize: '0.75rem', fontWeight: 700,
                        background: STATUS_COLOR[b.status], color: TEXT_COLOR[b.status]
                      }}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td style={{...S.td, textAlign: 'right'}}>
                      <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
                        {b.status !== 'paid' && (
                          <button style={S.actionBtn} onClick={() => markPaid(b.id)} title="Tandai Lunas">
                            <CheckCircle size={18} color="#10B981" />
                          </button>
                        )}
                        <button style={S.actionBtn} onClick={() => handleDelete(b.id)} title="Hapus">
                          <Trash2 size={18} color="#EF4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {billings.length === 0 && (
                  <tr><td colSpan="6" style={{textAlign:'center', padding:'3rem', color:'#64748B'}}>Belum ada tagihan tercatat</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Aesthetic Filler */}
        <div style={S.pagination}>
          <button style={S.pageBtn}>Previous</button>
          <div style={S.pageNumbers}>
            <span style={S.pageActive}>1</span>
          </div>
          <button style={S.pageBtn}>Next</button>
        </div>
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
  badgeCount: { background: '#E0F2FE', color: '#0369A1', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600 },
  
  tableContainer: { overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' },
  th: { padding: '1rem 0.5rem', borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', fontWeight: 600, color: '#64748B', background: '#FFFFFF' },
  tr: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '1.2rem 0.5rem', fontSize: '0.9rem', color: '#334155', verticalAlign: 'middle' },
  
  actionBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems:'center' },
  
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '1rem 0 0', borderTop: '1px solid #F1F5F9' },
  pageBtn: { padding: '0.5rem 1rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  pageNumbers: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  pageActive: { fontSize: '0.85rem', color: '#1E293B', background: '#F1F5F9', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: 6 },
}
