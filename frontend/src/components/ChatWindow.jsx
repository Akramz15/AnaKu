import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/axios'
import { useAuth } from '../context/AuthContext'
import { Smile, Send, ChevronLeft } from 'lucide-react'
import EmojiPicker from 'emoji-picker-react'

const UserAvatar = ({ name, size = 36, bg = 'var(--primary)' }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
    {name ? name[0].toUpperCase() : '?'}
  </div>
)

export default function ChatWindow({ roomId, receiverId, receiverName, receiverRole, onBack, onRoomCreated }) {
  const { profile } = useAuth()
  const [messages, setMessages]   = useState([])
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const bottomRef                 = useRef(null)
  const prevCountRef              = useRef(0)

  // ── Load & Realtime Messages ─────────────────────────────────────────────────
  const fetchMessages = () => {
    if (!roomId) return
    api.get(`/api/v1/chats/${roomId}/messages`).then(r => setMessages(r.data.data)).catch(console.error)
  }

  useEffect(() => {
    prevCountRef.current = 0 // Reset hitungan saat berganti ruangan agar chat baru otomatis scroll ke dasar
    if (!roomId) { setMessages([]); return }
    
    fetchMessages() // Ambil chat awal secara instan
    
    // 🚀 Live-wire Supabase Realtime Channel Subscription
    const channel = supabase
      .channel(`room_chat_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chats_human', filter: `room_id=eq.${roomId}` },
        () => { fetchMessages() } // Panggil API ulang secara instan saat data masuk
      )
      .subscribe()

    // 🛡️ Short Polling Fallback (jika Realtime Supabase dinonaktifkan oleh replikasi)
    const interval = setInterval(fetchMessages, 2500) 
    
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // ── Auto-scroll Cerdas ────────────────────────────────────────────────────
  useEffect(() => {
    // Hanya scroll otomatis jika jumlah pesan bertambah (menghindari benturan snap saat short polling 2.5s)
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCountRef.current = messages.length
  }, [messages])

  const send = async (e) => {
    e?.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await api.post('/api/v1/chats/send', {
        receiver_id: receiverId,
        message: text.trim(),
        room_id: roomId ?? null,
      })
      
      setText('')
      
      // Tangkap room_id baru jika room_id awalnya null
      const newRoomId = res.data?.data?.room_id
      
      if (!roomId && newRoomId && onRoomCreated) {
        onRoomCreated(newRoomId) // Beritahu Parent untuk mengunci Room ID baru
      } else {
        fetchMessages() // Ambil ulang pesan secara instan untuk visualisasi kilat
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={S.window}>
      {/* ── Chat Header ── */}
      <div style={S.chatHeader}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {onBack && (
            <button className="mobile-back-btn" onClick={onBack}>
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{receiverName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {receiverRole === 'caregiver' ? 'Pengasuh Senior' : receiverRole === 'parent' ? 'Orang Tua' : 'Administrator'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={S.messages}>
        {messages.map(msg => {
          const isOwn  = msg.sender_id === profile?.id
          const sender = msg.users?.full_name ?? (isOwn ? profile?.full_name : receiverName)
          const time   = new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <UserAvatar name={isOwn ? profile?.full_name : receiverName} size={36} bg={isOwn ? 'var(--primary-dark)' : '#CBD5E1'} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 500 }}>
                  {isOwn ? 'You' : sender}
                </div>
                <div style={{ ...S.bubble, ...(isOwn ? S.bubbleOwn : S.bubbleOther) }}>
                  {msg.message}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{time}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Bar ── */}
      <div style={{ position: 'relative' }}>
        {showEmoji && (
          <div style={{ position: 'absolute', bottom: '100%', right: '1.25rem', zIndex: 10 }}>
            <EmojiPicker onEmojiClick={(emojiData) => setText(prev => prev + emojiData.emoji)} />
          </div>
        )}
        <div style={S.inputBar}>
          <input
            style={S.input}
            placeholder="Type here..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div style={S.inputActions}>
            <button style={S.iconBtn} onClick={() => setShowEmoji(!showEmoji)}><Smile size={18} /></button>
            <button style={{ ...S.iconBtn, ...S.sendIconBtn }} onClick={send} disabled={!text.trim() || sending}>
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  window: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--surface)',
    borderRadius: '0 var(--radius-lg) var(--radius-lg) 0',
    overflow: 'hidden',
  },
  chatHeader: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  bubble: {
    padding: '0.65rem 0.9rem',
    borderRadius: 12,
    fontSize: '0.875rem',
    lineHeight: 1.55,
    wordBreak: 'break-word',
  },
  bubbleOwn: {
    background: '#FDECE7',
    color: 'var(--text)',
    borderTopRightRadius: 2,
  },
  bubbleOther: {
    background: '#F4F4F5',
    color: 'var(--text)',
    borderTopLeftRadius: 2,
  },
  inputBar: {
    borderTop: '1px solid var(--border)',
    padding: '0.9rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
    position: 'relative',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.9rem',
    color: 'var(--text)',
    paddingRight: '7rem',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    position: 'absolute',
    right: '1.25rem',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.3rem',
    borderRadius: 8,
  },
  sendIconBtn: {
    background: '#60B8D4',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    padding: '0.45rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
