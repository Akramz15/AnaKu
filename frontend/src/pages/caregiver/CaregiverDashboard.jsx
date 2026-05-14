import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../../components/layout/PageLayout'
import LiveTimer from '../../components/ui/LiveTimer'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/axios'
import { Baby, Moon, Shirt, Puzzle, Sparkles, Smile, Mic, Plus, ChevronDown, Send, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

const Avatar = ({ name, size=40 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
    {name ? name[0] : '?'}
  </div>
)

const ToggleBtn = ({ active, onClick }) => (
  <div onClick={onClick} style={{ width: '44px', height: '24px', background: active ? 'var(--accent)' : 'var(--border)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}>
    <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: active ? '22px' : '2px', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
  </div>
)

const getMoodColor = (score) => score < 25 ? '#F44336' : score <= 50 ? '#FF9800' : score <= 75 ? '#FFC107' : '#4CAF50'
const getMoodLabel = (score) => score < 25 ? 'Tantrum' : score <= 50 ? 'Sedih' : score <= 75 ? 'Netral' : 'Senang'

export default function CaregiverDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayLog, setTodayLog] = useState(null)
  const todayLogRef = useRef(null) 

  const [activeTasks, setActiveTasks] = useState({})
  const [historyTasks, setHistoryTasks] = useState([])
  const [moodScore, setMoodScore] = useState(50)
  const [isUpdatingMood, setIsUpdatingMood] = useState(false)
  const [todayAtt, setTodayAtt] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [todoInput, setTodoInput] = useState('')

  useEffect(() => { todayLogRef.current = todayLog }, [todayLog])

  // Fetch children on load
  useEffect(() => {
    api.get('/api/v1/children').then(r => {
      const list = r.data.data.filter(c => c.is_active)
      setChildren(list)
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) setSelectedChild(defaultChild)
    })
  }, [])

  // Fetch initial daily log — RESET semua state dulu saat anak berganti
  useEffect(() => {
    if (!selectedChild) return
    const today = new Date().toISOString().split('T')[0]

    // ⚠️ RESET state anak sebelumnya agar tidak bocor ke anak lain
    setTodayLog(null)
    todayLogRef.current = null
    setActiveTasks({})
    setHistoryTasks([])
    setMoodScore(50)
    setTodayAtt(null)
    setChecklist([])
    
    Promise.all([
      api.get(`/api/v1/daily-logs?child_id=${selectedChild.id}&log_date=${today}`),
      api.get(`/api/v1/attendances/?child_id=${selectedChild.id}`)
    ]).then(([resLog, resAtt]) => {
      const log = resLog.data.data[0]
      setTodayLog(log || null)
      const att = resAtt.data.data.find(a => a.date === today)
      setTodayAtt(att || null)

      // Handle Checklist Auto-Reset
      if (att && att.check_out_at) {
        localStorage.removeItem(`checklist_${selectedChild.id}_${today}`)
        setChecklist([])
      } else {
        const saved = localStorage.getItem(`checklist_${selectedChild.id}_${today}`)
        if (saved) setChecklist(JSON.parse(saved))
      }
        if (log && log.activities) {
          const actives = {}
          const history = []
          log.activities.forEach(act => {
            if (act.startsWith('START|')) {
              const parts = act.split('|')
              actives[parts[1]] = parts[2]
            } else if (act.startsWith('DONE|')) {
              const parts = act.split('|')
              history.unshift({ name: parts[1], time: parts[2], duration: parseInt(parts[3]) })
            }
          })
          setActiveTasks(actives)
          setHistoryTasks(history)
        } else {
          setActiveTasks({})
          setHistoryTasks([])
        }
        if (log && log.mood) {
          const ms = log.mood === 'ceria' ? 100 : log.mood === 'biasa' ? 75 : log.mood === 'rewel' ? 50 : 25
          setMoodScore(ms)
        }
      })
  }, [selectedChild])

  // saveToDb selalu membaca data terbaru via ref, bukan state (hindari stale closure)
  const saveToDb = useCallback(async (updates) => {
    if (!selectedChild) return
    const latestLog = todayLogRef.current
    const payload = {
      child_id: selectedChild.id,
      // Ambil nilai yang sudah ada dari DB (via ref), jangan pakai state yang bisa basi
      mood: latestLog?.mood ?? null,
      activities: latestLog?.activities ?? [],
      ...updates   // update terbaru override nilai lama
    }
    try {
      const res = await api.post('/api/v1/daily-logs', payload)
      // Langsung update state DAN ref dari respons server
      setTodayLog(res.data.data)
      todayLogRef.current = res.data.data
    } catch (err) {
      toast.error('Gagal sinkronisasi data')
    }
  }, [selectedChild])

  const updateMood = async (val) => {
    if (!selectedChild) return
    setMoodScore(val)
    
    let moodEnum = 'biasa'
    if (val < 25) moodEnum = 'menangis'
    else if (val <= 50) moodEnum = 'rewel'
    else if (val <= 75) moodEnum = 'biasa'
    else moodEnum = 'ceria'

    try {
      setIsUpdatingMood(true)
      await saveToDb({ mood: moodEnum })
    } catch (err) {
      console.error(err)
    } finally {
      setIsUpdatingMood(false)
    }
  }

  const toggleTask = (taskName) => {
    const currentActs = todayLog?.activities || []
    let nextActs = [...currentActs]

    if (activeTasks[taskName]) {
      // STOP
      const startTimeISO = activeTasks[taskName]
      const durationMin = Math.max(1, Math.round((Date.now() - new Date(startTimeISO).getTime()) / 60000))
      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      
      nextActs = nextActs.filter(a => !a.startsWith(`START|${taskName}|`))
      nextActs.push(`DONE|${taskName}|${endTime}|${durationMin}`)
      
      setActiveTasks(prev => { const n = {...prev}; delete n[taskName]; return n })
      setHistoryTasks(prev => [{ name: taskName, time: endTime, duration: durationMin }, ...prev])
    } else {
      // START - STOP OTHER TASKS FIRST (Single Activity Rule)
      const nowISO = new Date().toISOString()
      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      const stopped = []

      Object.keys(activeTasks).forEach(activeTaskName => {
        const startTimeISO = activeTasks[activeTaskName]
        const durationMin = Math.max(1, Math.round((Date.now() - new Date(startTimeISO).getTime()) / 60000))
        nextActs = nextActs.filter(a => !a.startsWith(`START|${activeTaskName}|`))
        nextActs.push(`DONE|${activeTaskName}|${endTime}|${durationMin}`)
        stopped.push({ name: activeTaskName, time: endTime, duration: durationMin })
      })

      nextActs.push(`START|${taskName}|${nowISO}`)
      setActiveTasks({ [taskName]: nowISO })
      if (stopped.length > 0) setHistoryTasks(prev => [...stopped, ...prev])
    }
    saveToDb({ activities: nextActs })
  }

  const toggleTodo = (idx) => {
    const today = new Date().toISOString().split('T')[0]
    const updated = [...checklist]
    updated[idx].done = !updated[idx].done
    setChecklist(updated)
    localStorage.setItem(`checklist_${selectedChild?.id}_${today}`, JSON.stringify(updated))
  }

  const addTodo = (e) => {
    if ((e.key === 'Enter' || e.type === 'click') && todoInput.trim()) {
      const today = new Date().toISOString().split('T')[0]
      const updated = [...checklist, { text: todoInput.trim(), done: false }]
      setChecklist(updated)
      localStorage.setItem(`checklist_${selectedChild?.id}_${today}`, JSON.stringify(updated))
      setTodoInput('')
    }
  }

  const TOGGLES = [
    { label: 'Makan', icon: <Baby size={24} />, bg: 'var(--info)' },
    { label: 'Tidur', icon: <Moon size={24} />, bg: 'var(--warning)' },
    { label: 'Ganti Popok', icon: <Shirt size={24} />, bg: 'var(--success)' },
    { label: 'Bermain', icon: <Puzzle size={24} />, bg: 'var(--primary-dark)' },
  ]

  const CHECKLIST = ['Makan', 'Tidur', 'Ganti Popok 1']

  return (
    <PageLayout>
      <div style={styles.page}>
           {/* Top Header Card */}
        <div className="header-card" style={styles.headerCard}>
          <div className="header-card-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={selectedChild?.full_name || 'A'} size={50} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>{selectedChild?.full_name || 'Pilih Anak'}</h2>
                {todayAtt?.check_in_at && !todayAtt?.check_out_at && (
                  <span style={styles.badgeGreen}>Checked In</span>
                )}
              </div>
              <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>Orang Tua: {selectedChild?.parent?.full_name || '-'}</p>
            </div>
          </div>
          <div className="header-card-right" style={{ display: 'flex', gap: '0.75rem' }}>

            <select style={styles.outlineBtn} value={selectedChild?.id || ''} onChange={e => {
              const child = children.find(c => c.id === e.target.value)
              if (child) {
                localStorage.setItem('selected_child_id', child.id)
                setSelectedChild(child)
              }
            }}>
              <option value="">-- Pilih --</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
        </div>

        {/* Main Grid Content */}
        <div className="dashboard-two-col" style={{ width: '100%' }}>
          
          {/* LEFT COLUMN */}
          <div className="dashboard-col-main" style={{ minHeight: 0 }}>
            
            {/* 4 Toggles Grid */}
            <div className="dashboard-grid">
              {TOGGLES.map(t => {
                const isActive = !!activeTasks[t.label]
                return (
                  <div key={t.label} style={{...styles.card, padding:'1.2rem', border: isActive ? `2px solid var(--accent)` : '1px solid var(--border)', background:'#fff'}}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', position:'relative', color: t.bg }}>
                      {t.icon}
                      <span style={{position:'absolute', top:-2, right:-2, color:'var(--warning)'}}><Sparkles size={12} /></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop:'auto' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize:'0.9rem' }}>{t.label}</span>
                      <ToggleBtn active={isActive} onClick={() => toggleTask(t.label)} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mood Anak */}
            <div style={{ ...styles.card, marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent:'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontWeight: 700, margin: 0 }}>Mood Anak</h3>
                  <span style={{...styles.badgeGreen, background: getMoodColor(moodScore), color:'#fff'}}>{getMoodLabel(moodScore)}</span>
                  {isUpdatingMood && <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Updating...</span>}
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '0.5rem' }}>
                Geser untuk memperbarui mood anak secara real-time.
              </p>
              
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', height: '40px' }}>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={moodScore} 
                  onChange={(e) => updateMood(parseInt(e.target.value))}
                  style={{ width: '100%', position: 'absolute', zIndex: 10, opacity: 0, cursor: 'pointer', height:'100%' }}
                />
                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '10px', width: '100%', position: 'relative', overflow:'hidden' }}>
                  <div style={{ height: '100%', width: `${moodScore}%`, background: getMoodColor(moodScore), borderRadius: '10px', transition: 'width 0.1s, background 0.1s' }}></div>
                </div>
                <div style={{ position: 'absolute', left: `calc(${moodScore}% - 15px)`, background: getMoodColor(moodScore), width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', pointerEvents: 'none', transition: 'left 0.1s, background 0.1s' }}>
                  <Smile size={16} />
                </div>
              </div>
            </div>

            {/* Daily Report */}
            <div style={{ ...styles.card, marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, margin: 0 }}>Daily Report</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Detail</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* Active Items */}
                {Object.keys(activeTasks).map(taskName => {
                  const t = TOGGLES.find(x => x.label === taskName) || { icon: <Baby size={24}/> }
                  return (
                    <div key={taskName} style={{ background: 'var(--info)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{t.icon}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{taskName}</div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                            <LiveTimer startTimeISO={activeTasks[taskName]} />
                          </div>
                        </div>
                      </div>
                      <button style={{ ...styles.whiteBtn, padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#0284c7' }}>Berjalan</button>
                    </div>
                  )
                })}

                {/* History Items */}
                {historyTasks.map((task, i) => {
                  const t = TOGGLES.find(x => x.label === task.name) || { icon: <Moon size={24}/> }
                  return (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', background: 'var(--secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>{t.icon}</div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{task.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{task.duration} menit</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{task.time}</div>
                    </div>
                  )
                })}
                
                {Object.keys(activeTasks).length === 0 && historyTasks.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada aktivitas.</div>
                )}

              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Checklist */}
          <div className="dashboard-col-side" style={{ ...styles.card }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.2rem' }}>Checklist Kegiatan</h3>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', overflowY: 'auto' }}>
              {checklist.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Belum ada daftar kegiatan.</div>}
              {checklist.map((item, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: item.done ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 500, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                  <div onClick={() => toggleTodo(idx)} style={{ width: '20px', height: '20px', border: '2px solid', borderColor: item.done ? 'var(--primary)' : 'var(--border)', background: item.done ? 'var(--primary)' : 'transparent', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    {item.done && <span style={{fontSize: '12px'}}>✓</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Tambah kegiatan..." 
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={addTodo}
                style={{ width: '100%', padding: '1rem 3rem 1rem 1.25rem', border: '1px solid #E2E8F0', borderRadius: '30px', outline: 'none', background: '#F8FAFC', color: '#1E293B', boxSizing: 'border-box' }}
              />
              <button 
                onClick={addTodo}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  background: '#60B8D4',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <Send size={16} style={{ marginLeft: '-2px' }} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </PageLayout>
  )
}

const styles = {
  page: { 
    padding: '0', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '1.25rem', 
    width: '100%', 
    maxWidth: '1400px', 
    margin: '0 auto',
    height: '100%'
  },
  headerCard: { 
    background: '#FFFFFF', 
    padding: '1.25rem 1.5rem', 
    borderRadius: '16px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  badgeGreen: { background: '#DCFCE7', color: '#15803D', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 },
  outlineBtn: { 
    background: '#FFFFFF', 
    border: '1px solid #E2E8F0', 
    padding: '0.5rem 1rem', 
    borderRadius: '10px', 
    cursor: 'pointer', 
    fontWeight: 600, 
    color: '#1E293B', 
    outline: 'none',
    fontSize: '0.9rem'
  },
  whiteBtn: { background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '0.5rem 1.25rem', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', color: '#1E293B' },
  iconBtn: { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' },
  mainGrid: { display: 'flex', gap: '1.25rem', alignItems: 'stretch', flex: 1, minHeight: 0 },
  leftCol: { flex: 2, display: 'flex', flexDirection: 'column', minHeight: 0 },
  togglesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' },
  card: { 
    background: '#FFFFFF', 
    padding: '1.5rem', 
    borderRadius: '16px', 
    display: 'flex', 
    flexDirection: 'column', 
    flex: 1,
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
}
