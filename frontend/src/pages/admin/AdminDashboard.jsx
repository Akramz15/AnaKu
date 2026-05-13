import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../../components/layout/PageLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/axios'

export default function AdminDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total:0, active:0, today:0, unpaid:0 })

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/children'),
      api.get('/api/v1/attendances'),
      api.get('/api/v1/billings'),
    ]).then(([c, a, b]) => {
      const today = new Date().toISOString().split('T')[0]
      setStats({
        total:  c.data.data.length,
        active: c.data.data.filter(x => x.is_active).length,
        today:  a.data.data.filter(x => x.date === today && x.status === 'present').length,
        unpaid: b.data.data.filter(x => x.status === 'unpaid').length,
      })
    })
  }, [])

  const CARDS = [
    { label:'Total Anak Terdaftar', value: stats.total,  icon:'👶', color:'var(--primary)',   path:'/admin/children' },
    { label:'Hadir Hari Ini',        value: stats.today,  icon:'✅', color:'var(--success)',   path:'/admin/qr-scanner' },
    { label:'Tagihan Belum Bayar',   value: stats.unpaid, icon:'💰', color:'var(--warning)',   path:'/admin/billing' },
    { label:'Scan Presensi',         value:'Buka',        icon:'📷', color:'var(--secondary)', path:'/admin/qr-scanner' },
  ]

  return (
    <PageLayout>
      <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ background: '#FFFFFF', padding: '1.5rem 2rem', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', border: '1px solid #F8F9FA' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#1E293B' }}>Halo, Admin {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p style={{ color: '#64748B', marginTop: '0.35rem', fontSize: '0.9rem' }}>
            Selamat datang di pusat kendali AnaKu.
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {CARDS.map(card => (
            <div 
              key={card.label} 
              style={{ 
                background: '#FFFFFF', 
                borderRadius: '16px', 
                padding: '1.5rem', 
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                border: '1px solid #F8F9FA',
                borderLeft: `4px solid ${card.color}`,
                transition: 'transform 0.2s ease'
              }}
              onClick={() => navigate(card.path)}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{card.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B' }}>{card.value}</div>
              <div style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.25rem' }}>{card.label}</div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
