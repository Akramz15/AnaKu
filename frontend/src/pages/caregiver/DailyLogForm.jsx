import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'
import PageLayout from '../../components/layout/PageLayout'
import { useAuth } from '../../context/AuthContext'
import { Plus, X, ClipboardList, Save, Pencil } from 'lucide-react'

const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const fmtDate = (s) => { const d = new Date(s+'T00:00:00'); return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}` }
const MEAL_TYPES  = ['Makan Pagi','Makan Siang','Snack']
const MOOD_OPTIONS = [
  { value:'ceria',    label:'Senang',  desc:'Jarang tantrum dan senang',      emoji:'😊', bg:'#4CAF50' },
  { value:'biasa',    label:'Netral',  desc:'Sesekali tantrum dan senang',    emoji:'😐', bg:'#FFC107' },
  { value:'rewel',    label:'Sedih',   desc:'Sering tantrum',                 emoji:'😟', bg:'#FF9800' },
  { value:'menangis', label:'Tantrum', desc:'Tantrum seharian',               emoji:'😠', bg:'#F44336' },
]
const EMPTY_SLOT = { start:'', end:'' }
const EMPTY_FORM = {
  draft_id:'', log_date:'', child_id:'', meal_entries:[{ type:'Makan Siang', description:'' }],
  sleep_slots:[{ ...EMPTY_SLOT },{ ...EMPTY_SLOT }], mood:'ceria',
}

export default function DailyLogForm() {
  const { profile } = useAuth()
  const [children, setChildren] = useState([])
  const [logs, setLogs]         = useState([])
  const [showForm, setShowForm] = useState(false)
  const [step, setStep]         = useState(1)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [loading, setLoading]   = useState(false)
  const [drafts, setDrafts]     = useState([])
  const [filterChildId, setFilterChildId] = useState('all')

  useEffect(() => {
    api.get('/api/v1/children/').then(r => setChildren(r.data.data))
    fetchLogs()
    const savedDrafts = localStorage.getItem('daily_log_drafts')
    if (savedDrafts) setDrafts(JSON.parse(savedDrafts))
  }, [])

  const fetchLogs = () => api.get('/api/v1/daily-logs').then(r => {
    setLogs([...r.data.data].sort((a,b) => b.log_date.localeCompare(a.log_date)))
  })

  const openForm = () => { 
    const initialForm = { 
      ...EMPTY_FORM, 
      child_id: filterChildId !== 'all' ? filterChildId : '' 
    }
    setForm(initialForm)
    setStep(1)
    setShowForm(true)
  }
  const closeForm = () => setShowForm(false)

  const handleSaveDraft = () => {
    let updatedDrafts = []
    const now = new Date().toISOString()
    
    if (form.draft_id) {
      // Mode Update Draft Eksisting
      updatedDrafts = drafts.map(d => d.draft_id === form.draft_id ? { ...form, updated_at: now } : d)
    } else {
      // Mode Tambah Draft Baru
      const newId = Date.now().toString()
      updatedDrafts = [{ ...form, draft_id: newId, updated_at: now }, ...drafts]
      setForm(f => ({ ...f, draft_id: newId }))
    }
    
    setDrafts(updatedDrafts)
    localStorage.setItem('daily_log_drafts', JSON.stringify(updatedDrafts))
    toast.success(form.draft_id ? 'Draft diperbarui' : 'Simpan sebagai draft')
    closeForm()
  }

  const loadDraft = (idx) => {
    setForm(drafts[idx])
    setStep(1)
    setShowForm(true)
  }

  const deleteDraft = (idx) => {
    const updated = drafts.filter((_, i) => i !== idx)
    setDrafts(updated)
    localStorage.setItem('daily_log_drafts', JSON.stringify(updated))
  }

  // ── HYDRATE SENT REPORT TO EDITABLE FORM ──
  const loadReport = (log) => {
    // 1. Parse Meal Entries from combined string
    let parsedMeals = []
    if (log.special_notes) {
      parsedMeals = log.special_notes.split('; ').map(part => {
        const bits = part.split(': ')
        return { type: bits[0] || 'Makan Siang', description: bits[1] || '' }
      }).filter(m => m.description || m.type)
    }
    if (parsedMeals.length === 0) parsedMeals = [{ type:'Makan Siang', description:'' }]

    // 2. Reconstruct ACTUAL sleep slots from saved activities
    let parsedSleep = []
    if (log.activities) {
      const doneSleeps = log.activities.filter(act => act.startsWith('DONE|Tidur|'))
      doneSleeps.forEach(act => {
        const [, , timeRange] = act.split('|')
        if (timeRange && timeRange.includes(' - ')) {
          const [start, end] = timeRange.split(' - ')
          parsedSleep.push({ start, end })
        }
      })
    }
    if (parsedSleep.length === 0) {
      parsedSleep = [{ start:'', end:'' }]
    }

    setForm({
      draft_id: '', // Clear draft correlation
      log_id: log.id,
      log_date: log.log_date, // Explicit overwrite key
      child_id: log.child_id,
      meal_entries: parsedMeals,
      sleep_slots: parsedSleep,
      mood: log.mood || 'ceria'
    })
    setStep(1)
    setShowForm(true)
  }

  // Meal entries helpers
  const setMealEntry = (i, key, val) => setForm(f => {
    const e = [...f.meal_entries]; e[i] = { ...e[i], [key]: val }; return { ...f, meal_entries: e }
  })
  const addMeal = () => setForm(f => ({ ...f, meal_entries: [...f.meal_entries, { type:'Makan Pagi', description:'' }] }))

  // Sleep slot helpers
  const setSleepSlot = (i, key, val) => setForm(f => {
    const s = [...f.sleep_slots]; s[i] = { ...s[i], [key]: val }; return { ...f, sleep_slots: s }
  })
  const addSleep = () => setForm(f => ({ ...f, sleep_slots: [...f.sleep_slots, { ...EMPTY_SLOT }] }))

  const calcDuration = () => {
    let mins = 0
    form.sleep_slots.forEach(s => {
      if (s.start && s.end) {
        const [sh,sm] = s.start.split(':').map(Number)
        const [eh,em] = s.end.split(':').map(Number)
        mins += Math.max(0,(eh*60+em)-(sh*60+sm))
      }
    })
    return mins || 60
  }

  const mealMap = { 'Makan Pagi':'meal_morning','Makan Siang':'meal_lunch','Snack':'meal_snack' }

  const handleKirim = async () => {
    if (!form.child_id) { toast.error('Pilih anak'); return }
    setLoading(true)
    try {
      // 1. Ambil data log harian eksisting hari ini agar tidak menimpa riwayat Tracker Live
      const targetDate = form.log_date || new Date().toISOString().split('T')[0]
      const getLog = await api.get(`/api/v1/daily-logs/?child_id=${form.child_id}&log_date=${targetDate}`)
      const existingLog = getLog.data.data?.[0]

      let mergedActivities = existingLog?.activities || []
      // Bersihkan entri Tidur sebelumnya agar tidak duplikasi
      mergedActivities = mergedActivities.filter(act => !act.includes('|Tidur|'))

      // 2. Sisipkan slot tidur baru dari Form ke dalam array mergedActivities
      form.sleep_slots.forEach(s => {
        if (s.start && s.end) {
          const [sh, sm] = s.start.split(':').map(Number)
          const [eh, em] = s.end.split(':').map(Number)
          const dur = Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
          mergedActivities.push(`DONE|Tidur|${s.start} - ${s.end}|${dur}`)
        }
      })

      const payload = {
        child_id: form.child_id,
        mood: form.mood,
        sleep_duration_min: calcDuration(),
        sleep_quality: calcDuration() >= 90 ? 'nyenyak' : calcDuration() >= 45 ? 'gelisah' : 'tidak_tidur',
        special_notes: form.meal_entries.map(m=>`${m.type}: ${m.description}`).join('; '),
        meal_morning:'habis', meal_lunch:'habis', meal_snack:'habis',
        health_notes:'', toilet_count:0,
        activities: mergedActivities // Kirim gabungan aktivitas baru yang aman dari overwrite
      }
      
      if (form.log_date) payload.log_date = form.log_date

      form.meal_entries.forEach(m => { if (mealMap[m.type]) payload[mealMap[m.type]] = 'habis' })
      await api.post('/api/v1/daily-logs/', payload)
      toast.success(form.log_date ? 'Laporan diperbarui!' : 'Laporan tersimpan!')
      
      // Bersihkan draft jika report ini berasal dari draft
      if (form.draft_id) {
         const newDrafts = drafts.filter(d => d.draft_id !== form.draft_id)
         setDrafts(newDrafts)
         localStorage.setItem('daily_log_drafts', JSON.stringify(newDrafts))
      }

      closeForm(); fetchLogs()
    } catch(e) { toast.error(e.response?.data?.detail || 'Gagal simpan') }
    setLoading(false)
  }

  const filteredLogs = filterChildId === 'all' 
    ? logs 
    : logs.filter(l => String(l.child_id) === String(filterChildId))

  return (
    <PageLayout>
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <h2 style={S.cardTitle}>Laporan Harian</h2>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select 
                style={{ 
                  padding: '0.4rem 0.75rem', 
                  borderRadius: '8px', 
                  border: '1px solid #E2E8F0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#374151',
                  background: '#fff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                value={filterChildId}
                onChange={e => setFilterChildId(e.target.value)}
              >
                <option value="all">Semua Anak</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <button style={S.plusBtn} onClick={openForm}><Plus size={18}/></button>
            </div>
          </div>
          <div>
            {filteredLogs.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.9rem' }}>Belum ada laporan untuk filter ini. Tekan + untuk menambahkan.</div>}
            {filteredLogs.map((log,i) => (
              <div key={log.id} style={{ ...S.logRow, borderBottom: i<filteredLogs.length-1?'1px solid var(--border)':'none' }}>
                <div style={S.logIcon}><ClipboardList size={20} color="#E07A5F"/></div>
                <div style={{ flex: 1 }}>
                  <div style={S.logDate}>{fmtDate(log.log_date)}</div>
                  <div style={S.logSub}>Anak: {log.children?.full_name} | Pengasuh: {log.caregiver?.full_name ?? 'Pengasuh'}</div>
                </div>
                <button 
                   onClick={() => loadReport(log)}
                   style={{ ...S.outlineBtn, flex: 'none', padding: '0.4rem 0.75rem', fontSize: '0.75rem', gap: '0.3rem' }}
                >
                   <Pencil size={13} /> Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── DRAFT SECTION ── */}
        {drafts.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <h2 style={S.cardTitle}>Draft Laporan</h2>
            </div>
            <div>
              {drafts.map((draft, i) => (
                <div key={i} style={{ ...S.logRow, background: '#FFFBEB', borderBottom: i<drafts.length-1?'1px solid var(--border)':'none', cursor: 'pointer' }} onClick={() => loadDraft(i)}>
                  <div style={{...S.logIcon, background: '#FEF3C7'}}><Save size={20} color="#D97706"/></div>
                  <div style={{ flex: 1 }}>
                    <div style={S.logDate}>Draft: {children.find(c => String(c.id) === String(draft.child_id))?.full_name || 'Tanpa Nama'}</div>
                    <div style={S.logSub}>Diubah: {new Date(draft.updated_at).toLocaleString('id-ID', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'})}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteDraft(i) }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem' }}>
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MODAL ── */}
        {showForm && (
          <div style={S.overlay} onClick={closeForm}>
            <div style={S.modal} onClick={e=>e.stopPropagation()}>

              {/* Modal static header */}
              <div style={{ padding:'1.75rem 1.75rem 0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
                  <div style={S.modalIconBox}><ClipboardList size={18} color="#374151"/></div>
                  <button style={S.closeBtn} onClick={closeForm}><X size={18}/></button>
                </div>
                <h3 style={{ margin:'0 0 0.25rem', fontWeight:700, fontSize:'1.15rem', color:'#1E293B' }}>
                   {form.log_date ? `Edit Laporan (${form.log_date})` : 'Tambahkan Laporan Baru'}
                </h3>
                <p style={{ margin:'0 0 1.5rem', fontSize:'0.82rem', color:'var(--text-muted)' }}>
                   {form.log_date ? 'Ubah data pelaporan harian yang telah dikirim.' : 'Laporkan Perkembangan Anak Hari Ini'}
                </p>
              </div>

              {/* ── STEP 1: Info + Jadwal Makan ── */}
              {step === 1 && (
                <div style={S.stepBody}>
                  {/* Nama Anak */}
                  <div style={S.field}>
                    <label style={S.label}>Nama Anak</label>
                    <select style={S.input} value={form.child_id} onChange={e=>setForm(f=>({...f,child_id:e.target.value}))}>
                      <option value="">Nama Anaku</option>
                      {children.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>

                  {/* Meal entries */}
                  {form.meal_entries.map((m,i) => (
                    <div key={i}>
                      <div style={S.field}>
                        <label style={S.label}>Jadwal Makan</label>
                        <div style={{ position:'relative' }}>
                          <select style={{ ...S.input, appearance:'none', paddingRight:'2.5rem' }} value={m.type} onChange={e=>setMealEntry(i,'type',e.target.value)}>
                            {MEAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                          <span style={{ position:'absolute', right:'0.9rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#94A3B8' }}>▾</span>
                        </div>
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>Deskripsi</label>
                        <textarea style={{ ...S.input, height:90, resize:'vertical' }} placeholder="e.g. Anak makan dengan lahap dan habis seluruh porsi makan siangnya." value={m.description} onChange={e=>setMealEntry(i,'description',e.target.value)}/>
                      </div>
                    </div>
                  ))}

                  {/* Add meal */}
                  <button type="button" style={S.dashedBtn} onClick={addMeal}>Tambahkan Jadwal Makan +</button>

                  {/* Footer */}
                  <div style={S.footer}>
                    <button type="button" style={S.outlineBtn} onClick={handleSaveDraft}><Save size={15}/> Simpan Draft</button>
                    <button type="button" style={S.primaryBtn} onClick={()=>setStep(2)}>Selanjutnya</button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Jam Tidur ── */}
              {step === 2 && (
                <div style={S.stepBody}>
                  {form.sleep_slots.map((slot,i) => (
                    <div key={i} style={{ marginBottom:'1rem' }}>
                      <div style={{ fontWeight:600, fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.65rem' }}>Jam Tidur {i+1}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                        <div>
                          <label style={{ ...S.label, marginBottom:'0.4rem', display:'block' }}>Start Time</label>
                          <input style={{ ...S.input, borderColor: slot.start ? '#E07A5F' : 'var(--border)' }} type="time" placeholder="Jam Mulai" value={slot.start} onChange={e=>setSleepSlot(i,'start',e.target.value)}/>
                        </div>
                        <div>
                          <label style={{ ...S.label, marginBottom:'0.4rem', display:'block' }}>End Time</label>
                          <input style={S.input} type="time" placeholder="Jam Selesai" value={slot.end} onChange={e=>setSleepSlot(i,'end',e.target.value)}/>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" style={S.dashedBtn} onClick={addSleep}>Tambahkan Jam Tidur +</button>

                  <div style={S.footer}>
                    <button type="button" style={S.outlineBtn} onClick={()=>setStep(1)}>Kembali</button>
                    <button type="button" style={{ ...S.outlineBtn, borderColor: 'var(--border)' }} onClick={handleSaveDraft}><Save size={14}/> Simpan Draft</button>
                    <button type="button" style={S.primaryBtn} onClick={()=>setStep(3)}>Selanjutnya</button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Suasana Hati ── */}
              {step === 3 && (
                <div style={S.stepBody}>
                  <div style={{ fontWeight:600, fontSize:'0.9rem', color:'var(--text)', marginBottom:'0.85rem' }}>Suasana Hati</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                    {MOOD_OPTIONS.map(opt => {
                      const active = form.mood === opt.value
                      return (
                        <div
                          key={opt.value}
                          style={{ ...S.moodCard, background: active ? '#FDECE7' : '#fff', border: active ? '1.5px solid #E07A5F' : '1.5px solid var(--border)' }}
                          onClick={()=>setForm(f=>({...f,mood:opt.value}))}
                        >
                          <div style={{ width:40, height:40, borderRadius:'50%', background:opt.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>{opt.emoji}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, fontSize:'0.9rem', color: active ? '#C0452A' : 'var(--text)' }}>{opt.label}</div>
                            <div style={{ fontSize:'0.78rem', color: active ? '#C0452A' : 'var(--text-muted)', opacity: active ? 0.85 : 1 }}>{opt.desc}</div>
                          </div>
                          <div style={{ width:18, height:18, borderRadius:'50%', border: active ? '5px solid #E07A5F' : '2px solid #CBD5E1', flexShrink:0, background:'#fff' }}/>
                        </div>
                      )
                    })}
                  </div>

                  <div style={S.footer}>
                    <button type="button" style={S.outlineBtn} onClick={()=>setStep(2)}>Kembali</button>
                    <button type="button" style={{ ...S.outlineBtn, borderColor: 'var(--border)' }} onClick={handleSaveDraft}><Save size={14}/> Simpan Draft</button>
                    <button type="button" style={{ ...S.primaryBtn, opacity: loading ? 0.7:1 }} onClick={handleKirim} disabled={loading}>{loading?'...':'Kirim'}</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

const S = {
  page:    { padding:'0', width:'100%', maxWidth:'1400px', margin:'0 auto', boxSizing:'border-box', display:'flex', flexDirection:'column', gap:'1.25rem', minHeight: '100%' },
  card:    { background:'#FFFFFF', borderRadius:'16px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.03)', border: '1px solid #F8F9FA' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' },
  cardTitle: { margin:0, fontWeight:800, fontSize:'1.2rem', color:'#1E293B' },
  plusBtn: { width:36, height:36, borderRadius:10, border:'1px solid #E2E8F0', background:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#1E293B', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
  logRow:  { display:'flex', alignItems:'center', gap:'1rem', padding:'1.25rem 1.5rem', borderBottom: '1px solid #F8FAFC' },
  logIcon: { width:44, height:44, borderRadius:12, background:'#FFF0EC', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  logDate: { fontWeight:600, fontSize:'0.95rem', color:'var(--text)', marginBottom:'0.2rem' },
  logSub:  { fontSize:'0.8rem', color:'var(--text-muted)' },

  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'1rem' },
  modal:   { background:'#fff', borderRadius:16, width:'100%', maxWidth:'500px', maxHeight:'100%', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.15)', overflow:'hidden' },
  modalIconBox: { width:40, height:40, borderRadius:10, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' },
  closeBtn: { background:'transparent', border:'none', cursor:'pointer', color:'#64748B', display:'flex', alignItems:'center', padding:'0.2rem', borderRadius:6 },
  stepBody: { flex:1, overflowY:'auto', padding:'0 1.75rem 1.75rem', display:'flex', flexDirection:'column', gap:'1rem' },

  field:    { display:'flex', flexDirection:'column', gap:'0.4rem' },
  label:    { fontSize:'0.82rem', fontWeight:600, color:'#374151' },
  input:    { border:'1px solid #E2E8F0', borderRadius:8, padding:'0.65rem 0.9rem', fontSize:'0.9rem', color:'#1E293B', outline:'none', background:'#fff', width:'100%', boxSizing:'border-box' },
  dashedBtn: { border:'1.5px dashed #CBD5E1', borderRadius:8, background:'transparent', padding:'0.75rem', width:'100%', cursor:'pointer', color:'#94A3B8', fontSize:'0.85rem', fontWeight:500, textAlign:'center' },

  moodCard: { display:'flex', alignItems:'center', gap:'0.85rem', padding:'0.85rem 1rem', borderRadius:10, cursor:'pointer', transition:'all 0.15s' },

  footer:  { display:'flex', gap:'0.5rem', marginTop:'0.5rem' },
  outlineBtn: { flex:1, border:'1.5px solid #E2E8F0', background:'#fff', borderRadius:8, padding:'0.7rem 0.25rem', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem', whiteSpace:'nowrap' },
  primaryBtn: { flex:1, border:'none', background:'#60B8D4', borderRadius:8, padding:'0.7rem 0.25rem', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', color:'#fff', whiteSpace:'nowrap' },
}
