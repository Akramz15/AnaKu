import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import ChatWindow from '../../components/ChatWindow'
import PageLayout from '../../components/layout/PageLayout'
import ParentPageHeader from '../../components/layout/ParentPageHeader'
import { useAuth } from '../../context/AuthContext'

const Avatar = ({ name, size = 50 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

const ContactAvatar = ({ name, size = 42 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: '#CBD5E1', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

const getRelativeTime = (isoStr) => {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)
  
  if (diffSec < 60) return 'Baru saja'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m lalu`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} jam lalu`
  
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Kemarin'
  
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    return days[date.getDay()]
  }
  
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function ParentChat() {
  const { profile }  = useAuth()
  const [contacts, setContacts]     = useState([])
  const [rooms, setRooms]           = useState([])
  const [selected, setSelected]     = useState(null)
  const [children, setChildren]     = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [todayAtt, setTodayAtt]     = useState(null)
  const [isLoading, setIsLoading]   = useState(true)

  useEffect(() => {
    const fetchRooms = () => {
      api.get('/api/v1/chats/rooms').then(r => setRooms(r.data.data)).catch(() => {})
    }

    Promise.all([
      api.get('/api/v1/chats/users/contacts'),
      api.get('/api/v1/children')
    ]).then(([contactsRes, childrenRes]) => {
      setContacts(contactsRes.data.data)
      
      const list = childrenRes.data.data
      setChildren(list)
      const savedId = localStorage.getItem('selected_child_id')
      const defaultChild = list.find(c => c.id === savedId) || list[0]
      if (defaultChild) setSelectedChild(defaultChild)
    }).catch(() => {}).finally(() => {
      setIsLoading(false)
    })
    
    fetchRooms()
    const interval = setInterval(fetchRooms, 3000) // short poll every 3s for dynamic list sort
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    const today = new Date().toISOString().split('T')[0]
    api.get(`/api/v1/attendances/?child_id=${selectedChild.id}`)
      .then(r => setTodayAtt(r.data.data.find(a => a.date === today) ?? null))
  }, [selectedChild?.id])

  // Otomatis buka obrolan jika diarahkan dari dashboard dengan handoff ID
  useEffect(() => {
    const targetId = localStorage.getItem('open_chat_user_id')
    if (targetId && contacts.length > 0) {
      const found = contacts.find(c => String(c.id) === String(targetId))
      if (found) {
        localStorage.removeItem('open_chat_user_id') // Hapus token agar tidak loop
        const existing = rooms.find(r => String(r.other_user_id) === String(found.id))
        setSelected({
          roomId:       existing?.room_id ?? null,
          receiverId:   found.id,
          name:         found.full_name,
          role:         found.role,
        })
      }
    }
  }, [contacts, rooms])

  // ── Merge Contacts with Latest Room Activity & Sort (identical logic) ──
  const sortedContacts = [...contacts].map(c => {
    const room = rooms.find(r => String(r.other_user_id) === String(c.id))
    return {
      ...c,
      last_time: room ? new Date(room.last_time).getTime() : 0,
      last_time_iso: room?.last_time || null,
      last_message: room?.last_message || '',
      unread_count: room?.unread_count || 0
    }
  }).sort((a, b) => b.last_time - a.last_time)

  const startChat = (contact) => {
    const existing = rooms.find(r => r.other_user_id === contact.id)
    setSelected({
      roomId:       existing?.room_id ?? null,
      receiverId:   contact.id,
      name:         contact.full_name,
      role:         contact.role,
    })
  }

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

        {/* ── Chat Layout ── */}
        <div className={`chat-layout ${selected ? 'has-active-chat' : ''}`} style={S.chatLayout}>

          {/* Left: Daftar Kontak */}
          <div className="chat-sidebar" style={S.contactPanel}>
            <div style={S.contactTitle}>Daftar Kontak</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {isLoading ? (
                <>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ ...S.contactRow, cursor: 'default' }}>
                      <div className="skeleton-shimmer" style={{ width: '42px', height: '42px', borderRadius: '50%' }} />
                      <div style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div className="skeleton-shimmer" style={{ height: '14px', width: '60%' }} />
                        <div className="skeleton-shimmer" style={{ height: '10px', width: '40%' }} />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {sortedContacts.map(c => {
                    const isActive = selected?.receiverId === c.id
                    return (
                      <div
                        key={c.id}
                        style={{ ...S.contactRow, ...(isActive ? S.contactRowActive : {}) }}
                        onClick={() => startChat(c)}
                      >
                        <ContactAvatar name={c.full_name} size={42} />
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.full_name}</div>
                            {c.last_time_iso && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                {getRelativeTime(c.last_time_iso)}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ overflow: 'hidden', flex: 1 }}>
                              {c.last_message ? (
                                 <div style={{ fontSize: '0.75rem', color: (c.unread_count > 0 && !isActive) ? 'var(--text)' : (isActive ? 'var(--primary)' : '#64748B'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: (c.unread_count > 0 && !isActive) ? 800 : 500 }}>
                                   {c.last_message}
                                 </div>
                              ) : (
                                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                   {c.role === 'caregiver' ? 'Pengasuh' : 'Admin'}
                                 </div>
                              )}
                            </div>
                            
                            {c.unread_count > 0 && !isActive && (
                              <div style={{ 
                                background: '#22C55E', // Hijau cerah ceria ala WhatsApp
                                color: '#fff', 
                                minWidth: '18px', 
                                height: '18px', 
                                borderRadius: '9px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '0.65rem', 
                                fontWeight: 800,
                                padding: '0 4px',
                                flexShrink: 0,
                                boxShadow: '0 1px 3px rgba(34, 197, 94, 0.3)'
                              }}>
                                {c.unread_count}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {sortedContacts.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                      Tidak ada kontak.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Chat Window */}
          <div className="chat-panel" style={S.chatPanel}>
            {selected
              ? <ChatWindow 
                  roomId={selected.roomId} 
                  receiverId={selected.receiverId} 
                  receiverName={selected.name} 
                  receiverRole={selected.role} 
                  onBack={() => setSelected(null)} 
                  onRoomCreated={(newId) => setSelected(prev => prev ? { ...prev, roomId: newId } : null)}
                />
              : (
                <div style={S.emptyChat}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                  <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    Pilih kontak untuk memulai percakapan
                  </p>
                </div>
              )
            }
          </div>
        </div>

      </div>
    </PageLayout>
  )
}

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
    background: '#FFFFFF',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    border: '1px solid #F8F9FA'
  },
  contactPanel: {
    width: '260px',
    flexShrink: 0,
    padding: '1.5rem 1rem',
    borderRight: '1px solid #F1F5F9',
    overflowY: 'auto',
    background: '#F8FAFC'
  },
  contactTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#1E293B',
    marginBottom: '1rem',
    paddingLeft: '0.5rem',
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '1px solid transparent',
    marginBottom: '0.25rem'
  },
  contactRowActive: {
    borderColor: '#E2E8F0',
    background: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
  },
  chatPanel: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#FFFFFF'
  },
  emptyChat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94A3B8',
  },
}
