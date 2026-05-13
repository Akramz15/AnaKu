import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import PageLayout from '../../components/layout/PageLayout'

export default function QRGenerator() {
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState('')
  const [qrData, setQrData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/api/v1/children').then(res => setChildren(res.data.data))
  }, [])

  const handleGenerate = async () => {
    if (!selectedChild) return
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/children/${selectedChild}/qr`)
      setQrData(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <PageLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>🔲 QR Code Generator</h1>
          <p style={styles.sub}>Cetak kartu QR untuk orang tua agar bisa melakukan presensi</p>
        </div>

        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Pilih Anak</label>
            <select style={styles.select} value={selectedChild}
              onChange={e => setSelectedChild(e.target.value)}>
              <option value="">-- Pilih Anak --</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <button style={styles.btn} onClick={handleGenerate} disabled={!selectedChild || loading}>
            {loading ? 'Memproses...' : 'Generate QR Code'}
          </button>
        </div>

        {qrData && (
          <div style={styles.result}>
            <div id="qr-card" style={styles.printableCard}>
              <div style={styles.cardHeader}>Kartu Presensi AnaKu</div>
              <img src={qrData.qr_base64} alt="QR Code" style={styles.qrImg} />
              <div style={styles.childName}>{qrData.name}</div>
              <div style={styles.cardFooter}>Tunjukkan QR ini saat antar/jemput anak</div>
            </div>
            <button style={styles.printBtn} onClick={handlePrint}>🖨️ Cetak / Simpan PDF</button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #qr-card, #qr-card * { visibility: visible; }
          #qr-card { position: absolute; left: 0; top: 0; border: 2px solid #000 !important; width: 300px; padding: 20px; }
        }
      `}</style>
    </PageLayout>
  )
}

const styles = {
  page: { padding: '0 1rem 3rem', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  header: { 
    textAlign: 'center',
    background: '#FFFFFF',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  title: { fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#1E293B' },
  sub: { color: '#64748B', fontSize: '0.9rem', marginTop: '0.5rem' },
  card: { 
    background: '#FFFFFF', 
    border: '1px solid #F8F9FA', 
    borderRadius: '16px', 
    padding: '2rem', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  label: { fontSize: '0.9rem', fontWeight: 600, color: '#475569' },
  select: { 
    background: '#F8FAFC', 
    border: '1px solid #E2E8F0', 
    borderRadius: '10px', 
    padding: '0.85rem 1rem', 
    color: '#1E293B', 
    outline: 'none', 
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  btn: { background: '#1E293B', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' },
  result: { marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' },
  printableCard: { background: '#fff', color: '#000', padding: '2rem', borderRadius: '16px', textAlign: 'center', width: '300px', border: '1px solid #F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  cardHeader: { fontWeight: 800, fontSize: '1.2rem', marginBottom: '1.5rem', color: '#1E293B' },
  qrImg: { width: '200px', height: '200px', marginBottom: '1rem' },
  childName: { fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1E293B' },
  cardFooter: { fontSize: '0.75rem', color: '#64748B' },
  printBtn: { background: '#FFFFFF', color: '#1E293B', border: '1px solid #E2E8F0', padding: '0.75rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
}
