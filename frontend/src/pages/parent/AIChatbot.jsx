import { useEffect, useRef, useState, useCallback } from 'react'
import api from '../../lib/axios'
import { useAuth } from '../../context/AuthContext'
import PageLayout from '../../components/layout/PageLayout'
import ParentPageHeader from '../../components/layout/ParentPageHeader'
import { Plus, Smile, Mic, MessageSquare, Trash2, AlertCircle, Send, ChevronLeft } from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  'Hari ini anak saya makan dengan baik tidak?',
  'Bagaimana suasana hati anak saya hari ini?',
  'Berapa lama anak saya tidur siang?',
  'Apa saja kegiatan anak saya hari ini?',
]

const STORAGE_KEY = (childId) => `anaku_ai_sessions_${childId}`

const genId = () => Math.random().toString(36).slice(2, 10)

const fmtDate = (isoStr) => {
  const d = new Date(isoStr)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 50, bg = 'var(--primary)' }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

// ─── Confirmation Modal ────────────────────────────────────────────────────────
const ConfirmModal = ({ onConfirm, onCancel }) => (
  <div className="modal-overlay" style={M.overlay}>
    <div style={M.box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <AlertCircle size={22} color="#F59E0B" />
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Buat Percakapan Baru?</h3>
      </div>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Percakapan saat ini akan disimpan di riwayat sebelah kiri dan Anda dapat mengaksesnya kapan saja.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button style={M.cancelBtn} onClick={onCancel}>Batal</button>
        <button style={M.confirmBtn} onClick={onConfirm}>Ya, Buat Baru</button>
      </div>
    </div>
  </div>
)

const M = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  box: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '380px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' },
  confirmBtn: { background: 'var(--accent)', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, color: '#fff', fontSize: '0.88rem' },
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AIChatbot() {
  const { profile } = useAuth()

  // Child selector
  const [children, setChildren]               = useState([])
  const [selectedChild, setSelectedChild]     = useState(null)
  const [todayAtt, setTodayAtt]               = useState(null)

  // Session management
  const [sessions, setSessions]               = useState([])   // [{id, title, createdAt, messages}]
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages]               = useState([])

  // UI
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [isPageLoading, setIsPageLoading]     = useState(true)
  const bottomRef                             = useRef(null)

  // ── Load children ─────────────────────────────────────────────────────────
  useEffect(() => {
    setIsPageLoading(true)
    api.get('/api/v1/children').then(r => {
      const list = r.data.data
      setChildren(list)
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) setSelectedChild(defaultChild)
    }).finally(() => {
      setIsPageLoading(false)
    })
  }, [])

  // ── Load attendance + sessions when child changes ─────────────────────────
  useEffect(() => {
    if (!selectedChild) {
      const welcomeMsg = { role: 'model', text: 'Halo! Selamat datang di Tanya AI. Jika anak Anda sudah terdaftar oleh admin daycare, asisten AI pintar kami siap menemani dan menganalisis riwayat perkembangan anak Anda di sini.', time: new Date().toISOString() }
      setSessions([])
      setActiveSessionId(null)
      setMessages([welcomeMsg])
      return
    }
    const today = new Date().toISOString().split('T')[0]

    api.get(`/api/v1/attendances/?child_id=${selectedChild.id}`)
      .then(r => setTodayAtt(r.data.data.find(a => a.date === today) ?? null))

    // Load saved sessions from localStorage
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY(selectedChild.id)) || '[]')

    if (saved.length > 0) {
      setSessions(saved)
      const last = saved[saved.length - 1]
      setActiveSessionId(last.id)
      setMessages(last.messages)
    } else {
      // First time — create initial session
      const initMsg = { role: 'model', text: `Halo! Saya Asisten AnaKu. Saya siap membantu Anda memahami kondisi ${selectedChild.full_name} hari ini. Silakan tanyakan apa saja!`, time: new Date().toISOString() }
      const session = { id: genId(), title: `Percakapan 1`, createdAt: new Date().toISOString(), messages: [initMsg] }
      setSessions([session])
      setActiveSessionId(session.id)
      setMessages([initMsg])
      localStorage.setItem(STORAGE_KEY(selectedChild.id), JSON.stringify([session]))
    }
  }, [selectedChild?.id])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (showConfirm) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [showConfirm])

  // ── Persist session changes to localStorage ───────────────────────────────
  const persistSessions = useCallback((updatedSessions) => {
    if (!selectedChild) return
    localStorage.setItem(STORAGE_KEY(selectedChild.id), JSON.stringify(updatedSessions))
    setSessions(updatedSessions)
  }, [selectedChild])

  // ── Update active session messages ────────────────────────────────────────
  const syncMessages = useCallback((newMessages) => {
    setMessages(newMessages)
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: newMessages } : s)
      if (selectedChild) localStorage.setItem(STORAGE_KEY(selectedChild.id), JSON.stringify(updated))
      return updated
    })
  }, [activeSessionId, selectedChild])

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !selectedChild || loading) return
    const userMsg = { role: 'user', text: input.trim(), time: new Date().toISOString() }
    const next = [...messages, userMsg]
    syncMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/api/v1/ai/chat', { child_id: selectedChild.id, message: userMsg.text })
      const aiMsg = { role: 'model', text: res.data.data.reply, time: new Date().toISOString() }
      syncMessages([...next, aiMsg])
    } catch {
      const errMsg = { role: 'model', text: 'Maaf, terjadi gangguan. Silakan coba lagi.', time: new Date().toISOString() }
      syncMessages([...next, errMsg])
    }
    setLoading(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Create new session ────────────────────────────────────────────────────
  const createNewSession = () => {
    const initMsg = { role: 'model', text: `Percakapan baru dimulai. Tanyakan apa saja tentang ${selectedChild?.full_name}!`, time: new Date().toISOString() }
    const session = { id: genId(), title: `Percakapan ${sessions.length + 1}`, createdAt: new Date().toISOString(), messages: [initMsg] }
    const updated = [...sessions, session]
    persistSessions(updated)
    setActiveSessionId(session.id)
    setMessages([initMsg])
    setShowConfirm(false)
  }

  // ── Switch session ────────────────────────────────────────────────────────
  const switchSession = (session) => {
    setActiveSessionId(session.id)
    setMessages(session.messages)
  }

  // ── Delete session ────────────────────────────────────────────────────────
  const deleteSession = (e, sessionId) => {
    e.stopPropagation()
    const updated = sessions.filter(s => s.id !== sessionId)
    persistSessions(updated)
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        const last = updated[updated.length - 1]
        setActiveSessionId(last.id)
        setMessages(last.messages)
      } else {
        createNewSession()
      }
    }
  }

  return (
    <PageLayout>
      <div style={S.page}>

        {/* ── Page Header ── */}
        <ParentPageHeader
          selectedChild={selectedChild}
          children={children}
          todayAtt={todayAtt}
          onChildChange={setSelectedChild}
        />


        {/* ── Chat Layout (sidebar + main) ── */}
        <div className={`chat-layout ${activeSessionId ? 'has-active-chat' : ''}`} style={S.chatLayout}>
          {isPageLoading ? (
            <>
              {/* Left Sidebar Shimmer */}
              <div className="chat-sidebar" style={{ ...S.sidebar, display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', borderRight: '1px solid var(--border)' }}>
                <div className="skeleton-shimmer" style={{ height: '20px', width: '70%', borderRadius: '4px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff' }}>
                      <div className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div className="skeleton-shimmer" style={{ height: '14px', width: '80%', borderRadius: '3px' }} />
                        <div className="skeleton-shimmer" style={{ height: '10px', width: '50%', borderRadius: '2px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Right Panel Shimmer */}
              <div className="chat-panel" style={{ ...S.chatCard, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div className="skeleton-shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '16px', width: '150px', borderRadius: '4px' }} />
                    <div className="skeleton-shimmer" style={{ height: '12px', width: '220px', borderRadius: '3px' }} />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '60%', alignItems: 'flex-start' }}>
                    <div className="skeleton-shimmer" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                    <div className="skeleton-shimmer" style={{ height: '70px', flex: 1, borderRadius: '16px 16px 16px 4px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '60%', marginLeft: 'auto', alignItems: 'flex-start' }}>
                    <div className="skeleton-shimmer" style={{ height: '60px', width: '240px', borderRadius: '16px 16px 4px 16px' }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── Left Sidebar: Session History ── */}
              <div className="chat-sidebar" style={S.sidebar}>
                <div style={{ ...S.sidebarHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)' }}>Riwayat Chat</span>
                  <button style={{ ...S.plusBtn, width: 28, height: 28 }} onClick={() => setShowConfirm(true)} title="Percakapan baru">
                    <Plus size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', flex: 1 }}>
                  {[...sessions].reverse().map(session => (
                    <div
                      key={session.id}
                      style={{ ...S.sessionRow, ...(session.id === activeSessionId ? S.sessionRowActive : {}) }}
                      onClick={() => switchSession(session)}
                    >
                      <MessageSquare size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {session.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtDate(session.createdAt)}</div>
                      </div>
                      <button
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0, opacity: 0.6 }}
                        onClick={e => deleteSession(e, session.id)}
                        title="Hapus"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Main Chat Area ── */}
              <div className="chat-panel" style={S.chatCard}>
                {/* Card Header */}
                <div style={S.chatCardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button className="mobile-back-btn" onClick={() => setActiveSessionId(null)}>
                      <ChevronLeft size={20} />
                    </button>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>Tanya AI</h3>
                  </div>
                  <button style={S.plusBtn} onClick={() => setShowConfirm(true)} title="Percakapan baru">
                    <Plus size={18} />
                  </button>
                </div>

                {/* Messages */}
                <div style={S.messages}>
                  {messages.map((msg, i) => {
                    const isUser = msg.role === 'user'
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '0.7rem', marginBottom: '1.5rem' }}>
                        <Avatar name={isUser ? profile?.full_name : 'AI'} size={36} bg={isUser ? 'var(--primary-dark)' : '#CBD5E1'} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '78%', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            {isUser ? (profile?.full_name ?? 'Anda') : 'Asisten AnaKu'}
                          </span>
                          {isUser ? (
                            <div style={S.userBubble}>{msg.text}</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                              {msg.text.split('\n\n').filter(p => p.trim()).map((para, pi) => (
                                <div key={pi} style={S.aiBubble}>{para.trim()}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {loading && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', marginBottom: '1.5rem' }}>
                      <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, maxWidth: '65%' }}>
                        <div className="skeleton-shimmer" style={{ height: '12px', width: '100px', borderRadius: '4px' }} />
                        <div className="skeleton-shimmer" style={{ height: '46px', width: '100%', borderRadius: '16px 16px 16px 4px' }} />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Quick Question Chips (Horizontal swipe row) */}
                <div className="no-scrollbar" style={S.quickWrap}>
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button key={i} style={S.quickChip} onClick={() => setInput(q)} disabled={!selectedChild}>{q}</button>
                  ))}
                </div>

                {/* Input Bar */}
                <div style={S.inputBar}>
                  <input
                    style={{ ...S.input, cursor: !selectedChild ? 'not-allowed' : 'text' }}
                    placeholder={selectedChild ? "Type here..." : "Hubungi admin untuk mendaftarkan anak..."}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={loading || !selectedChild}
                  />
                  <div style={S.inputActions}>
                    <button style={{ ...S.iconBtn, ...S.sendIconBtn, background: selectedChild ? '#60B8D4' : '#CBD5E1', cursor: !selectedChild ? 'not-allowed' : 'pointer' }} onClick={sendMessage} disabled={!input.trim() || loading || !selectedChild}>
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Confirmation Modal ── */}
        {showConfirm && (
          <ConfirmModal
            onConfirm={createNewSession}
            onCancel={() => setShowConfirm(false)}
          />
        )}

      </div>
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
  chatLayout: {
    flex: 1,
    display: 'flex',
    gap: 0,
    minHeight: 0,
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    borderRight: '1px solid #F1F5F9',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'hidden',
    background: '#F8FAFC'
  },
  sidebarHeader: {
    padding: '1.25rem 1rem',
    borderBottom: '1px solid #F1F5F9',
    flexShrink: 0,
  },
  sessionRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    padding: '0.75rem',
    borderRadius: '10px',
    margin: '0.25rem 0.5rem',
    cursor: 'pointer',
    color: '#1E293B',
    transition: 'all 0.15s',
  },
  sessionRowActive: {
    background: '#FFFFFF',
    borderColor: '#E2E8F0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    fontWeight: 600,
  },
  chatCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    background: '#FFFFFF'
  },
  chatCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #F1F5F9',
    flexShrink: 0,
  },
  plusBtn: {
    width: 32, height: 32, borderRadius: 8,
    border: '1px solid #E2E8F0',
    background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#1E293B',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  aiBubble: {
    background: '#F1F5F9', borderRadius: 12, borderTopLeftRadius: 2,
    padding: '0.75rem 1rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#1E293B',
  },
  userBubble: {
    background: '#FFF4F1', borderRadius: 12, borderTopRightRadius: 2,
    padding: '0.75rem 1rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#1E293B',
  },
  quickWrap: {
    display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '0.6rem',
    padding: '0.6rem 1.25rem', borderTop: '1px solid #F1F5F9', flexShrink: 0,
    WebkitOverflowScrolling: 'touch',
  },
  quickChip: {
    background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 999,
    padding: '0.4rem 0.9rem', fontSize: '0.75rem', color: '#64748B',
    cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
  },
  inputBar: {
    borderTop: '1px solid #F1F5F9', padding: '1rem 1.5rem',
    display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative',
  },
  input: {
    flex: 1, border: '1px solid #E2E8F0', outline: 'none', background: '#F8FAFC',
    fontSize: '0.9rem', color: '#1E293B', padding: '0.75rem 3rem 0.75rem 1rem',
    borderRadius: '12px'
  },
  inputActions: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    position: 'absolute', right: '2rem',
  },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#64748B', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '0.3rem', borderRadius: 8,
  },
  sendIconBtn: {
    background: '#60B8D4', color: '#fff',
    border: 'none', borderRadius: '50%', padding: '0.45rem',
  },
}
