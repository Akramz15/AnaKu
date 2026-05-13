import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import api from '../../lib/axios'
import PageLayout from '../../components/layout/PageLayout'
import toast from 'react-hot-toast'

export default function QRScanner() {
  const [scanResult, setScanResult] = useState(null)
  const [isScanning, setIsScanning] = useState(true)
  const scannerRef = useRef(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    })

    scanner.render(onScanSuccess, onScanError)
    scannerRef.current = scanner

    return () => {
      scanner.clear().catch(err => console.error('Failed to clear scanner', err))
    }
  }, [])

  const onScanSuccess = async (decodedText) => {
    if (!isScanning) return
    
    setIsScanning(false) // Pause scanning
    setScanResult('Memproses...')
    
    try {
      const res = await api.post('/api/v1/attendances/scan', { qr_data: decodedText })
      toast.success(res.data.message, { duration: 5000 })
      setScanResult(res.data.message)
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Gagal memproses QR'
      toast.error(errMsg)
      setScanResult(`Error: ${errMsg}`)
    } finally {
      // Tunggu 3 detik sebelum bisa scan lagi
      setTimeout(() => {
        setIsScanning(true)
        setScanResult(null)
      }, 3000)
    }
  }

  const onScanError = (err) => {
    // Terlalu berisik jika di console, abaikan saja scan error biasa
  }

  return (
    <PageLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>📷 QR Scanner Presensi</h1>
          <p style={styles.sub}>Arahkan kamera ke QR Code Orang Tua untuk Check-in / Check-out</p>
        </div>

        <div style={styles.scannerWrapper}>
          <div id="reader" style={styles.reader}></div>
          
          {scanResult && (
            <div style={{...styles.resultCard, 
              background: scanResult.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}}>
              {scanResult}
            </div>
          )}

          {!scanResult && isScanning && (
            <div style={styles.status}>
              <span style={styles.pulse}></span> Sedang mencari QR Code...
            </div>
          )}
        </div>

        <div style={styles.instructions}>
          <h3>💡 Petunjuk:</h3>
          <ul>
            <li>Pastikan pencahayaan cukup terang.</li>
            <li>Posisikan QR Code di tengah kotak pemindai.</li>
            <li>Sistem akan mendeteksi otomatis apakah ini Check-in atau Check-out.</li>
          </ul>
        </div>
      </div>
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
  scannerWrapper: { 
    background: '#FFFFFF', 
    borderRadius: '16px', 
    padding: '1.5rem', 
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)', 
    border: '1px solid #F8F9FA',
    position: 'relative', 
    overflow: 'hidden' 
  },
  reader: { width: '100%', borderRadius: '12px', overflow: 'hidden' },
  status: { textAlign: 'center', marginTop: '1rem', color: '#64748B', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
  pulse: { width: '8px', height: '8px', background: '#0EA5E9', borderRadius: '50%' },
  resultCard: { marginTop: '1rem', padding: '1rem', borderRadius: '12px', color: '#fff', textAlign: 'center', fontWeight: 700 },
  instructions: { 
    background: '#FFFFFF', 
    padding: '1.5rem', 
    borderRadius: '16px', 
    color: '#64748B', 
    fontSize: '0.85rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)', 
    border: '1px solid #F8F9FA' 
  },
}
