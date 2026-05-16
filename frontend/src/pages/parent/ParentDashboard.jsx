import { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import LiveTimer from '../../components/ui/LiveTimer'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/axios'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import EditProfileModal from '../../components/EditProfileModal'
import { Pencil, MessageCircle, Clock, Smile, Baby, Moon, Mic, Plus, Send, Shirt, Puzzle } from 'lucide-react'

// Mock icons as emojis or simple spans since we don't have lucide-react installed currently
const Avatar = ({ name, photo_url, size=40 }) => (
  photo_url ? (
    <img src={photo_url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
      {name ? name[0] : '?'}
    </div>
  )
)

// Helper function to map activity names to icons
const getTaskIcon = (taskName, size=24) => {
  switch(taskName) {
    case 'Makan': return <Baby size={size} />
    case 'Tidur': return <Moon size={size} />
    case 'Ganti Popok': return <Shirt size={size} />
    case 'Bermain': return <Puzzle size={size} />
    default: return <Baby size={size} />
  }
}

const ACT_COLORS = {
  Makan:       { bgInactive: '#E0F2FE', bgActive: '#0284C7', fgActive: '#0284C7' },
  Tidur:       { bgInactive: '#FEF3C7', bgActive: '#D97706', fgActive: '#D97706' },
  'Ganti Popok':{ bgInactive: '#DCFCE7', bgActive: '#16A34A', fgActive: '#16A34A' },
  Bermain:     { bgInactive: '#F3E8FF', bgActive: '#9333EA', fgActive: '#9333EA' },
}
const getActColors = (name) => ACT_COLORS[name] ?? { bgInactive: '#F1F5F9', bgActive: '#0284C7', fgActive: '#64748B' }

const getParentMoodColor = (mood) => mood === 'ceria' ? '#4CAF50' : mood === 'biasa' ? '#FFC107' : mood === 'rewel' ? '#FF9800' : mood === 'menangis' ? '#F44336' : '#38C976'
const getParentMoodLabel = (mood) => mood === 'ceria' ? 'Senang' : mood === 'biasa' ? 'Netral' : mood === 'rewel' ? 'Sedih' : mood === 'menangis' ? 'Tantrum' : 'Good'

export default function ParentDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayLog, setTodayLog] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [caregivers, setCaregivers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Tanya AI state
  const STORAGE_KEY = (childId) => `anaku_ai_sessions_${childId}`
  const genId = () => Math.random().toString(36).slice(2, 10)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      const list = r.data.data || []
      setChildren(list)
      if (list.length === 0) {
        setIsLoading(false)
        return
      }
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) setSelectedChild(defaultChild)
    }).catch(() => setIsLoading(false))
    // Ambil daftar pengasuh resmi dari server secara dinamis
    api.get('/api/v1/chats/users/contacts')
      .then(r => setCaregivers(r.data.data))
      .catch(() => {})
  }, [])

  // Reset semua state saat anak berganti agar data tidak bocor antar anak
  useEffect(() => {
    if (!selectedChild) {
      setMessages([{ role: 'model', text: 'Halo! Selamat datang di AnaKu. Jika anak Anda sudah terdaftar oleh admin daycare, fitur chatbot analisis AI kami siap membantu memantau perkembangan anak Anda di sini.', time: new Date().toISOString() }])
      return
    }
    setIsLoading(true)
    setTodayLog(null)
    setTodayAttendance(null)
    setChatInput('')

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY(selectedChild.id)) || '[]')
    if (saved.length > 0) {
      setMessages(saved[saved.length - 1].messages)
    } else {
      const initMsg = { role: 'model', text: `Halo! Saya Asisten AnaKu. Saya siap membantu Anda memahami kondisi ${selectedChild.full_name} hari ini. Silakan tanyakan apa saja!`, time: new Date().toISOString() }
      const session = { id: genId(), title: `Percakapan 1`, createdAt: new Date().toISOString(), messages: [initMsg] }
      localStorage.setItem(STORAGE_KEY(selectedChild.id), JSON.stringify([session]))
      setMessages([initMsg])
    }
  }, [selectedChild?.id])

  useEffect(() => {
    if (!selectedChild) return
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const cid = selectedChild.id

    const fetchData = () => {
      Promise.all([
        api.get(`/api/v1/daily-logs?child_id=${cid}&log_date=${today}`),
        api.get(`/api/v1/attendances/?child_id=${cid}`),
      ]).then(([logRes, attRes]) => {
        setTodayLog(logRes.data.data[0] || null)
        const todayAtt = attRes.data.data.find(a => a.date === today)
        setTodayAttendance(todayAtt || null)
        setIsLoading(false)
      })
    }

    fetchData() // initial fetch

    // Real-time polling every 3 seconds — hanya read, tidak write
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [selectedChild?.id]) // Gunakan selectedChild?.id bukan selectedChild (object) agar tidak trigger ulang terus

  const syncMessages = (newMessages) => {
    setMessages(newMessages)
    if (!selectedChild) return
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY(selectedChild.id)) || '[]')
    if (saved.length > 0) {
      saved[saved.length - 1].messages = newMessages
      localStorage.setItem(STORAGE_KEY(selectedChild.id), JSON.stringify(saved))
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || isSending || !selectedChild) return
    const userMsg = { role: 'user', text: chatInput.trim(), time: new Date().toISOString() }
    const next = [...messages, userMsg]
    syncMessages(next)
    setChatInput('')
    setIsSending(true)

    try {
      const res = await api.post('/api/v1/ai/chat', { message: userMsg.text, child_id: selectedChild.id })
      const aiMsg = { role: 'model', text: res.data.data.reply, time: new Date().toISOString() }
      syncMessages([...next, aiMsg])
    } catch (e) {
      toast.error('Gagal mengirim pesan')
      const errMsg = { role: 'model', text: 'Maaf, terjadi gangguan. Silakan coba lagi.', time: new Date().toISOString() }
      syncMessages([...next, errMsg])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
    <PageLayout>
      <div style={styles.page}>
        
        {/* Top Header Card */}
        <div className="header-card" style={styles.headerCard}>
          <div className="header-card-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={selectedChild?.full_name || 'A'} photo_url={selectedChild?.photo_url} size={50} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>{selectedChild?.full_name || 'Nama Anaku'}</h2>
                {todayAttendance?.check_in_at && !todayAttendance?.check_out_at && (
                  <span style={styles.badgeGreen}>Checked In</span>
                )}
                {todayAttendance?.check_out_at && (
                  <span style={{ ...styles.badgeGreen, background: '#FEF3C7', color: '#92400E' }}>Picked Up</span>
                )}
              </div>
              <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>{profile?.full_name || 'Orang Tua'}</p>
            </div>
          </div>
          <div className="header-card-right" style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={styles.outlineBtn} onClick={() => setShowEdit(true)}>
              Edit Profil <Pencil size={14} style={{marginLeft: '0.5rem'}}/>
            </button>
            <select style={styles.outlineBtn} value={selectedChild?.id || ''} onChange={e => {
              const child = children.find(c => c.id === e.target.value)
              if (child) {
                localStorage.setItem('selected_child_id', child.id)
                setSelectedChild(child)
              }
            }}>
              {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
        </div>

        {/* Top Cards Row */}
        <div className="dashboard-grid-3" style={{ width: '100%' }}>
          
          {isLoading ? (
            <>
              {/* Skeleton Card 1: Kabar Anaku */}
              <div style={{ ...styles.card, gap: '0.75rem' }}>
                <div className="skeleton-shimmer" style={{ height: '22px', width: '60%' }} />
                <div className="skeleton-shimmer" style={{ height: '14px', width: '100%', marginTop: '0.5rem' }} />
                <div className="skeleton-shimmer" style={{ height: '14px', width: '90%' }} />
                <div className="skeleton-shimmer" style={{ height: '14px', width: '80%' }} />
                <div className="skeleton-shimmer" style={{ height: '38px', width: '120px', borderRadius: '20px', marginTop: 'auto' }} />
              </div>
              {/* Skeleton Card 2: Caregivers */}
              <div style={styles.card}>
                <div className="skeleton-shimmer" style={{ height: '22px', width: '70%', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
                  <div className="skeleton-shimmer" style={{ height: '64px', borderRadius: '16px' }} />
                  <div className="skeleton-shimmer" style={{ height: '64px', borderRadius: '16px' }} />
                </div>
              </div>
              {/* Skeleton Card 3: Attendance */}
              <div style={styles.card}>
                <div className="skeleton-shimmer" style={{ height: '22px', width: '50%', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
                  <div className="skeleton-shimmer" style={{ height: '74px', borderRadius: '12px' }} />
                  <div className="skeleton-shimmer" style={{ height: '74px', borderRadius: '12px' }} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 1. Kabar Anaku (Peach Background) */}
              <div style={{ ...styles.card, background: '#F4A590', border: 'none' }}>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', marginTop: 0 }}>Kabar Anaku</h3>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.95)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                  {todayLog?.ai_daily_summary || 'Si kecil melewati hari dengan sangat ceria dan kooperatif, mulai dari menghabiskan seluruh makanannya hingga tidur siang dengan sangat pulas. Secara keseluruhan, kondisinya terpantau sangat baik dan aktif.'}
                </p>
                <button style={styles.ovalWhiteBtn} onClick={() => navigate('/parent/daily-log')}>
                  Baca Laporan
                </button>
              </div>

              {/* 2. Pengasuh Yang Bertugas */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Pengasuh Yang Bertugas</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center', flex: 1 }}>
                  {caregivers.length > 0 ? (
                    caregivers.map(cg => (
                      <div key={cg.id} style={{ 
                        background: '#E2ECEB', borderRadius: '16px', 
                        padding: '1rem 1.5rem', width: '100%', 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1E293B', marginBottom: '0.2rem' }}>
                            {cg.full_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>Pengasuh Resmi</div>
                        </div>
                        <div 
                          style={{ 
                            background: '#fff', width: 36, height: 36, borderRadius: '50%', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                            flexShrink: 0
                          }} 
                          onClick={() => {
                            localStorage.setItem('open_chat_user_id', cg.id)
                            navigate('/parent/chat')
                          }}
                        >
                          <MessageCircle size={18} color="#1E293B" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      background: '#E2ECEB', borderRadius: '16px', 
                      padding: '1.25rem 1.5rem', width: '100%', 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      boxSizing: 'border-box'
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1E293B', marginBottom: '0.2rem' }}>
                          {todayLog?.caregiver?.full_name || 'Maggie Johnson'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>Pengasuh Senior</div>
                      </div>
                      <div 
                        style={{ 
                          background: '#fff', width: 36, height: 36, borderRadius: '50%', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          flexShrink: 0
                        }} 
                        onClick={() => navigate('/parent/chat')}
                      >
                        <MessageCircle size={18} color="#1E293B" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Check In/Out */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Check In/Out</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
                  
                  {/* IN */}
                  <div style={{ 
                    background: (todayAttendance?.check_in_at && !todayAttendance?.check_out_at) ? '#DCFCE7' : '#F4F4F5', 
                    borderStyle: 'solid', 
                    borderWidth: '1px', 
                    borderColor: (todayAttendance?.check_in_at && !todayAttendance?.check_out_at) ? '#A7F3D0' : '#E5E7EB',
                    borderRadius: '12px', padding: '1rem'
                  }}>
                    <div style={{ 
                      fontSize: '0.7rem', fontWeight: 700, 
                      color: (todayAttendance?.check_in_at && !todayAttendance?.check_out_at) ? '#15803D' : '#64748B', 
                      marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' 
                    }}>
                      <div style={{
                        width: 6, height: 6, 
                        background: (todayAttendance?.check_in_at && !todayAttendance?.check_out_at) ? '#15803D' : '#64748B', 
                        borderRadius: '50%'
                      }}></div> Checking In
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B' }}>
                      {todayAttendance?.check_in_at ? fmt12h(todayAttendance.check_in_at) : '—'}
                    </div>
                  </div>

                  {/* OUT */}
                  <div style={{ 
                    background: todayAttendance?.check_out_at ? '#FEE2E2' : '#F4F4F5', 
                    borderRadius: '12px', padding: '1rem', 
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: todayAttendance?.check_out_at ? '#FECACA' : '#E5E7EB'
                  }}>
                    <div style={{ 
                      fontSize: '0.7rem', fontWeight: 700, 
                      color: todayAttendance?.check_out_at ? '#B91C1C' : '#64748B', 
                      marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' 
                    }}>
                      <div style={{
                        width: 6, height: 6, 
                        background: todayAttendance?.check_out_at ? '#B91C1C' : '#64748B', 
                        borderRadius: '50%'
                      }}></div> Pick Up
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: todayAttendance?.check_out_at ? '#1E293B' : '#94A3B8' }}>
                      {todayAttendance?.check_out_at ? fmt12h(todayAttendance.check_out_at) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Split Content Row */}
        <div className="dashboard-two-col" style={{ width: '100%' }}>
          
          {/* LEFT COLUMN (Mood & Daily Report) */}
          <div className="dashboard-col-main" style={{ gap: '1.25rem' }}>
            
            {isLoading ? (
              <>
                {/* Skeleton Mood Card */}
                <div style={styles.card}>
                  <div className="skeleton-shimmer" style={{ height: '22px', width: '40%', marginBottom: '1rem' }} />
                  <div className="skeleton-shimmer" style={{ height: '48px', borderRadius: '12px' }} />
                </div>
                {/* Skeleton Daily Report Card */}
                <div style={{ ...styles.card, flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: '22px', width: '35%', marginBottom: '1.5rem' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '58px', borderRadius: '12px' }} />
                    <div className="skeleton-shimmer" style={{ height: '58px', borderRadius: '12px' }} />
                    <div className="skeleton-shimmer" style={{ height: '58px', borderRadius: '12px' }} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Mood Card */}
                <div style={styles.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>Mood Anak</h3>
                    <span style={{ ...styles.badgeGreen, background: getParentMoodColor(todayLog?.mood), color: '#fff' }}>{getParentMoodLabel(todayLog?.mood)}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '0 0 1rem' }}>Suasana hati stabil.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '12px' }}>
                    <Smile size={24} color={getParentMoodColor(todayLog?.mood)} />
                    <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: todayLog?.mood === 'ceria' ? '100%' : todayLog?.mood === 'biasa' ? '70%' : todayLog?.mood === 'rewel' ? '40%' : todayLog?.mood === 'menangis' ? '15%' : '100%', 
                        height: '100%', 
                        background: getParentMoodColor(todayLog?.mood), 
                        borderRadius: '4px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                </div>

                {/* Daily Report Card */}
                <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={styles.cardTitle}>Daily Report</h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', cursor: 'pointer' }}>Detail</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(() => {
                      const actives = []
                      const history = []
                      if (todayLog?.activities) {
                        todayLog.activities.forEach(act => {
                          if (act.startsWith('START|')) {
                            const parts = act.split('|')
                            actives.push({ name: parts[1], startTime: parts[2] })
                          } else if (act.startsWith('DONE|')) {
                            const parts = act.split('|')
                            history.unshift({ name: parts[1], time: parts[2], duration: parts[3] })
                          }
                        })
                      }
                      
                      if (actives.length === 0 && history.length === 0) {
                        return <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>Belum ada aktivitas hari ini.</div>
                      }

                      return (
                        <>
                          {actives.map((task, i) => {
                            const clr = getActColors(task.name)
                            return (
                              <div key={i} style={{ background: clr.bgActive, borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 3px 10px ${clr.bgActive}15` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{getTaskIcon(task.name, 20)}</div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{task.name}</div>
                                    <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 800 }}><LiveTimer startTimeISO={task.startTime} /></div>
                                  </div>
                                </div>
                                <span style={{ background: '#fff', color: clr.bgActive, padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>Sekarang</span>
                              </div>
                            )
                          })}
                          {history.map((task, i) => {
                            const clr = getActColors(task.name)
                            return (
                              <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ width: 44, height: 44, background: clr.bgInactive, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: clr.fgActive }}>{getTaskIcon(task.name, 20)}</div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>{task.name}</div>
                                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{task.duration} menit</div>
                                  </div>
                                </div>
                                <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>{task.time}</span>
                              </div>
                            )
                          })}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* RIGHT COLUMN (Tanya AI) */}
          <div className="dashboard-col-side" style={{ ...styles.card, height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={styles.cardTitle}>Tanya AI</h3>
            </div>

            <div style={{ height: '380px', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
              {messages.map((m, i) => {
                const isUser = m.role === 'user'
                return (
                  <div key={i} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '95%' }}>
                    {!isUser && <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.2rem', marginLeft: '0.2rem' }}>Tanya AI</div>}
                    <div style={{ 
                      background: isUser ? '#EEF2F6' : '#F4F4F5', 
                      color: '#334155', 
                      padding: '0.85rem 1.15rem', 
                      borderRadius: '12px',     
                      fontSize: '0.95rem', 
                      lineHeight: 1.6 
                    }}>
                      {m.text}
                    </div>
                  </div>
                )
              })}
              {isSending && <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Mengetik...</div>}
            </div>

            {/* Input Bar matches exact screenshot footer input */}
            <div style={{ 
              marginTop: 'auto',
              border: '1px solid #E2E8F0', borderRadius: '12px', 
              padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff' 
            }}>
              <input 
                type="text" 
                placeholder={selectedChild ? "Type here..." : "Hubungi admin untuk menghubungkan anak..."}
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                disabled={!selectedChild}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', color: '#1E293B', cursor: !selectedChild ? 'not-allowed' : 'text' }}
              />
              <button 
                onClick={sendChat} 
                disabled={!chatInput.trim() || isSending || !selectedChild} 
                style={{ 
                  ...styles.roundBtn, 
                  background: selectedChild ? '#60B8D4' : '#CBD5E1', 
                  width: 32, 
                  height: 32, 
                  border: 'none', 
                  display:'flex', 
                  alignItems:'center', 
                  justifyContent:'center', 
                  cursor: !selectedChild ? 'not-allowed' : 'pointer' 
                }}
              >
                <Send size={14} color="#fff"/>
              </button>
            </div>
          </div>

        </div>

      </div>
    </PageLayout>

    <EditProfileModal
      isOpen={showEdit}
      onClose={() => setShowEdit(false)}
      childData={selectedChild}
    />
    </>
  )
}

// Helper for formatting 12h time in UI rendering
const fmt12h = (isoStr) => {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return isoStr
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

const styles = {
  page: { 
    padding: '0', 
    height: '100%',
    display: 'flex', 
    flexDirection: 'column', 
    gap: '1.25rem', 
    width: '100%', 
    maxWidth: '1400px', 
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  headerCard: { 
    background: '#FFFFFF', 
    padding: '1.25rem 1.5rem', 
    borderRadius: '16px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
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
    display: 'flex', alignItems: 'center'
  },
  ovalWhiteBtn: { 
    background: '#fff', border: 'none', 
    padding: '0.5rem 1.25rem', borderRadius: '25px', 
    fontWeight: 700, fontSize: '0.75rem', color: '#F4A590', 
    cursor: 'pointer', width: 'fit-content'
  },
  roundBtn: { 
    width: '36px', height: '36px', borderRadius: '50%', 
    border: '1px solid #E2E8F0', background: '#fff', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    cursor: 'pointer', color: '#1E293B' 
  },
  card: { 
    background: '#FFFFFF', padding: '1.5rem', 
    borderRadius: '16px', display: 'flex', 
    flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  cardTitle: { 
    fontSize: '1rem', fontWeight: 700, color: '#1E293B', 
    marginTop: 0, marginBottom: '1rem' 
  },
  topCardsGrid: { 
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', 
    gap: '1.25rem', width: '100%' 
  },
  mainGrid: { 
    display: 'grid', gridTemplateColumns: '1.2fr 1fr', 
    gap: '1.25rem', alignItems: 'stretch',
    flex: 1,
    minHeight: 0
  },
  leftCol: { 
    display: 'flex', flexDirection: 'column', gap: '1.25rem' 
  },
}

