import { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ParentPageHeader from '../../components/layout/ParentPageHeader'
import LiveTimer from '../../components/ui/LiveTimer'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/axios'
import { Baby, Moon, Shirt, Puzzle, ClipboardList, ChevronDown, Download } from 'lucide-react'
import DailyLogDetailModal from '../../components/DailyLogDetailModal'

// ─── Icon helper ───────────────────────────────────────────────────────────────
const getTaskIcon = (name, size = 22) => {
  switch (name) {
    case 'Makan':      return <Baby  size={size} />
    case 'Tidur':      return <Moon  size={size} />
    case 'Ganti Popok':return <Shirt size={size} />
    case 'Bermain':    return <Puzzle size={size} />
    default:           return <Baby  size={size} />
  }
}

const ICON_BG = {
  Makan:       { bg: '#84D6FE', color: '#0369A1' },
  Tidur:       { bg: '#C7D2FE', color: '#4338CA' },
  'Ganti Popok':{ bg: '#BBF7D0', color: '#15803D' },
  Bermain:     { bg: '#FDE68A', color: '#92400E' },
}
const getIconStyle = (name) => ICON_BG[name] ?? { bg: '#E0F2FE', color: '#0284C7' }

// Format tanggal Indonesia
const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const MONTHS_ID_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const formatDateFull = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID_FULL[d.getMonth()]} ${d.getFullYear()}`
}

export default function ParentDailyLog() {
  const { profile } = useAuth()
  const [children, setChildren]             = useState([])
  const [selectedChild, setSelectedChild]   = useState(null)
  const [todayLog, setTodayLog]             = useState(null)
  const [todayAtt, setTodayAtt]             = useState(null)
  const [weekLogs, setWeekLogs]             = useState([])
  const [activityFilter, setActivityFilter] = useState('Hari Ini')
  const [reportFilter, setReportFilter]     = useState('Minggu Ini')
  const [detailLog, setDetailLog]           = useState(null)
  const [allAtts, setAllAtts]               = useState([])
  const [allLogs, setAllLogs]               = useState([]) // Simpan seluruh data untuk lokal filtering

  const isInRange = (dateStr, filter) => {
    if (!dateStr) return false
    const d = new Date(dateStr + 'T00:00:00')
    const now = new Date()
    now.setHours(0,0,0,0)
    const dTime = d.getTime()
    const nTime = now.getTime()
    
    if (filter === 'Hari Ini') {
      return dateStr === new Date().toISOString().split('T')[0]
    }
    if (filter === 'Minggu Ini') {
      return dTime >= (nTime - 7 * 86400000)
    }
    if (filter === 'Bulan Ini') {
      return dTime >= (nTime - 30 * 86400000)
    }
    if (filter === 'Tahun Ini') {
      return d.getFullYear() === now.getFullYear()
    }
    return true
  }

  // ── fetch anak (terfilter per parent di backend) ──────────────────────────
  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      const list = r.data.data
      setChildren(list)
      if (list[0]) setSelectedChild(list[0])
    })
  }, [])

  // ── reset & fetch data saat anak berganti ─────────────────────────────────
  useEffect(() => {
    if (!selectedChild) return
    setTodayLog(null)
    setTodayAtt(null)
    setWeekLogs([])

    const today = new Date().toISOString().split('T')[0]
    const cid   = selectedChild.id

    const fetchAll = () => {
      Promise.all([
        api.get(`/api/v1/daily-logs?child_id=${cid}&log_date=${today}`),
        api.get(`/api/v1/attendances?child_id=${cid}`),
        api.get(`/api/v1/daily-logs?child_id=${cid}`),
      ]).then(([logRes, attRes, historyRes]) => {
        setTodayLog(logRes.data.data[0] ?? null)
        const allAtt = attRes.data.data
        setAllAtts(allAtt)
        setTodayAtt(allAtt.find(a => a.date === today) ?? null)
        
        const allHistory = historyRes.data.data || []
        setAllLogs(allHistory)
        
        // Legacy hook update just in case, but we'll replace mapped logic below
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
        setWeekLogs(allHistory.filter(l => l.log_date >= sevenDaysAgo))
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 3000) // real-time sync
    return () => clearInterval(interval)
  }, [selectedChild?.id])

  // ── parse cumulative activities based on filter ─────────────────────────────
  const { activeItems, historyItems } = (() => {
    const active  = []
    const history = []
    
    const filteredLogs = allLogs.filter(log => isInRange(log.log_date, activityFilter))
    
    filteredLogs.forEach(l => {
      if (!l.activities) return
      l.activities.forEach(act => {
        if (act.startsWith('START|')) {
          const [, name, startTime] = act.split('|')
          // Tampilkan Timer Live hanya jika tanggalnya adalah hari ini
          if (l.log_date === new Date().toISOString().split('T')[0]) {
            active.push({ name, startTime })
          }
        } else if (act.startsWith('DONE|')) {
          const [, name, time, duration] = act.split('|')
          history.push({ name, time, duration, date: l.log_date })
        }
      })
    })
    
    // Sort history chronologically: newest date first
    history.sort((a, b) => b.date.localeCompare(a.date))
    
    return { activeItems: active, historyItems: history }
  })()

  // Compute derived filtered reports list
  const filteredReports = allLogs.filter(log => isInRange(log.log_date, reportFilter))


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


        {/* ── Kegiatan Anak ── */}
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>Kegiatan Anak</h2>
            <div style={{ position: 'relative' }}>
              <select 
                style={{ ...S.outlineBtn, paddingRight: '2rem', appearance: 'none' }} 
                value={activityFilter} 
                onChange={e => setActivityFilter(e.target.value)}
              >
                <option value="Hari Ini">Hari Ini</option>
                <option value="Minggu Ini">Minggu Ini</option>
                <option value="Bulan Ini">Bulan Ini</option>
                <option value="Tahun Ini">Tahun Ini</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Active Items — real-time */}
            {activeItems.map(task => {
              const ic = getIconStyle(task.name)
              return (
                <div key={task.name} style={{ ...S.activeCard }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      {getTaskIcon(task.name, 24)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{task.name}</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: 1 }}>
                        <LiveTimer startTimeISO={task.startTime} />
                      </div>
                    </div>
                  </div>
                  <button style={S.sekarangBtn}>Sekarang</button>
                </div>
              )
            })}

            {/* History Items */}
            {historyItems.map((task, i) => {
              const ic = getIconStyle(task.name)
              return (
                <div key={i} style={S.historyCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ic.color, flexShrink: 0 }}>
                      {getTaskIcon(task.name, 22)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {task.name}
                        {activityFilter !== 'Hari Ini' && (
                          <span style={{ fontSize: '0.65rem', background: '#F1F5F9', color: '#64748B', padding: '0.15rem 0.4rem', borderRadius: '6px' }}>{new Date(task.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{task.duration} menit</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{task.time}</div>
                </div>
              )
            })}

            {activeItems.length === 0 && historyItems.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Belum ada kegiatan hari ini.
              </div>
            )}
          </div>
        </div>

        {/* ── Laporan Harian ── */}
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>Laporan Harian</h2>
            <div style={{ position: 'relative' }}>
              <select 
                style={{ ...S.outlineBtn, paddingRight: '2rem', appearance: 'none' }} 
                value={reportFilter} 
                onChange={e => setReportFilter(e.target.value)}
              >
                <option value="Hari Ini">Hari Ini</option>
                <option value="Minggu Ini">Minggu Ini</option>
                <option value="Bulan Ini">Bulan Ini</option>
                <option value="Tahun Ini">Tahun Ini</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredReports.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Belum ada laporan untuk periode ini.
              </div>
            )}
            {filteredReports.map(log => (
              <div key={log.id} style={S.reportRow}>
                <div style={S.reportIcon}>
                  <ClipboardList size={20} color="var(--primary-dark)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
                    {formatDateFull(log.log_date)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Pengasuh : {log.caregiver?.full_name ?? 'Tidak diketahui'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    style={S.detailBtn}
                    onClick={() => setDetailLog(log)}
                  >
                    Detail
                  </button>
                  <button
                    style={S.downloadBtn}
                    onClick={() => setDetailLog({ ...log, _autoDownload: true })}
                  >
                    <Download size={14} /> Unduh
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Daily Log Detail Modal ── */}
      {detailLog && (
        <DailyLogDetailModal
          log={detailLog}
          childName={selectedChild?.full_name ?? 'Anak'}
          att={allAtts.find(a => a.date === detailLog.log_date) ?? null}
          autoDownload={detailLog._autoDownload ?? false}
          onClose={() => setDetailLog(null)}
        />
      )}
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
  outlineBtn: { 
    background: 'transparent', border: '1px solid #E2E8F0', 
    padding: '0.5rem 1rem', borderRadius: '10px', 
    cursor: 'pointer', fontWeight: 600, color: '#1E293B', 
    fontSize: '0.8rem', outline: 'none',
    display: 'flex', alignItems: 'center', gap: '0.5rem'
  },
  section: {
    background: '#FFFFFF',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA',
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  sectionTitle: {
    margin: 0,
    fontWeight: 700,
    fontSize: '1.1rem',
    color: '#1E293B',
  },
  activeCard: {
    background: '#93CFF5', // Matches dashboard active blue
    borderRadius: 16,
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  },
  sekarangBtn: {
    background: '#fff',
    border: 'none',
    borderRadius: 20,
    padding: '0.35rem 1.2rem',
    fontWeight: 700,
    color: '#56A1D8',
    cursor: 'pointer',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  historyCard: {
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: '0.85rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  },
  reportRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '12px',
    background: '#F8FAFC',
    marginBottom: '0.5rem'
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#E0F2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#0284C7'
  },
  detailBtn: {
    padding: '0.4rem 1rem',
    border: '1px solid #E2E8F0',
    background: '#fff',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#1E293B',
  },
  downloadBtn: {
    padding: '0.4rem 1rem',
    border: 'none',
    background: '#84D6FE', // Light blue as requested
    color: '#fff',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
}
