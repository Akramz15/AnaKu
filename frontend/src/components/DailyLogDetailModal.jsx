import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

// ── Format helpers ────────────────────────────────────────────────────────────
const MONTHS_ID_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

const formatDateFull = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID_FULL[d.getMonth()]} ${d.getFullYear()}`
}

const fmt12h = (isoStr) => {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return isoStr
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2,'0')}:${m} ${ampm}`
}

// ── Parse sleep sessions from activities ─────────────────────────────────────
const parseSleepSessions = (activities = []) => {
  const sessions = []
  const done = activities.filter(a => a.startsWith('DONE|Tidur|'))
  done.forEach((a, i) => {
    const [, , time, duration] = a.split('|')
    sessions.push({ label: `Tidur ${i + 1}`, duration: `${duration} menit`, time })
  })
  return sessions
}

// ── Parse meal info ───────────────────────────────────────────────────────────
const buildMealInfo = (log) => {
  if (log.special_notes && log.special_notes.includes(':')) {
    return log.special_notes.split('; ').map(part => {
      const bits = part.split(': ')
      return { label: bits[0] || 'Makan', desc: bits.slice(1).join(': ') || 'Habis' }
    }).filter(m => m.desc && m.label)
  }

  const meals = []
  if (log.meal_morning) meals.push({ label: 'Makan Pagi', desc: log.meal_morning })
  if (log.meal_lunch)   meals.push({ label: 'Makan Siang', desc: log.meal_lunch })
  if (log.meal_snack)   meals.push({ label: 'Makan Sore', desc: log.meal_snack })
  return meals
}

// ── Mood config (keys semua lowercase agar case-insensitive) ──────────────────
const MOOD_CONFIG = {
  senang:  { emoji: '😄', bg: '#DCFCE7', label: 'Senang' },
  bahagia: { emoji: '😊', bg: '#DCFCE7', label: 'Bahagia' },
  ceria:   { emoji: '😊', bg: '#DCFCE7', label: 'Ceria' },
  netral:  { emoji: '😐', bg: '#FEF9C3', label: 'Netral' },
  sedih:   { emoji: '😢', bg: '#DBEAFE', label: 'Sedih' },
  rewel:   { emoji: '😠', bg: '#FEE2E2', label: 'Rewel' },
  tantrum: { emoji: '😡', bg: '#FEE2E2', label: 'Tantrum' },
  lelah:   { emoji: '😴', bg: '#F1F5F9', label: 'Lelah' },
  takut:   { emoji: '😨', bg: '#FEF3C7', label: 'Takut' },
}
// lookup tidak peka huruf besar/kecil
const getMoodConfig = (mood) => {
  if (!mood) return { emoji: '😐', bg: '#F3F4F6', label: 'Tidak ada' }
  const key = mood.toLowerCase().trim()
  return MOOD_CONFIG[key] ?? { emoji: '😐', bg: '#F3F4F6', label: mood }
}

// ── PDF Download ──────────────────────────────────────────────────────────────
const downloadPDF = (log, childName, att) => {
  const dateLabel = formatDateFull(log.log_date)
  const caregiver = log.caregiver?.full_name ?? 'Tidak diketahui'
  const meals = buildMealInfo(log)
  const sleepSessions = parseSleepSessions(log.activities || [])
  const mood = getMoodConfig(log.mood)

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1E293B; font-size: 14px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #64748B; font-size: 13px; margin-bottom: 12px; }
  .badges { display: flex; gap: 8px; margin-bottom: 24px; }
  .badge-green { background: #DCFCE7; color: #15803D; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-red   { background: #FEE2E2; color: #DC2626; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: 600; color: #64748B; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-box { border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 12px 16px; font-weight: 500; font-size: 15px; }
  .meal-box { background: #EFF6FF; border-radius: 12px; padding: 16px; }
  .meal-label { font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #1E40AF; }
  .meal-desc { font-size: 13px; color: #334155; margin-bottom: 12px; }
  .meal-desc:last-child { margin-bottom: 0; }
  .sleep-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
  .sleep-row:last-child { border-bottom: none; }
  .mood-box { background: ${mood.bg}; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 14px; }
  .mood-emoji { font-size: 36px; }
  .mood-label { font-weight: 700; font-size: 15px; }
  .mood-notes { font-size: 13px; color: #475569; margin-top: 4px; }
  .footer { margin-top: 40px; text-align: center; color: #94A3B8; font-size: 11px; border-top: 1px solid #E2E8F0; padding-top: 16px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>Laporan ${dateLabel}</h1>
<div class="sub">Pengasuh : ${caregiver}</div>
<div class="badges">
  ${att?.check_in_at ? `<span class="badge-green">Checked In : ${fmt12h(att.check_in_at)}</span>` : ''}
  ${att?.check_out_at ? `<span class="badge-red">Checked Out : ${fmt12h(att.check_out_at)}</span>` : ''}
</div>

<div class="section">
  <div class="section-title">Nama Anak</div>
  <div class="field-box">${childName}</div>
</div>

${meals.length > 0 ? `
<div class="section">
  <div class="section-title">Jadwal Makan</div>
  <div class="meal-box">
    ${meals.map(m => `<div class="meal-label">${m.label}</div><div class="meal-desc">${m.desc}</div>`).join('')}
  </div>
</div>` : ''}

${sleepSessions.length > 0 ? `
<div class="section">
  <div class="section-title">Laporan Tidur</div>
  ${sleepSessions.map(s => `
    <div class="sleep-row" style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:20px;">💤</span>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between;">
          <div><strong>${s.label}</strong><br><span style="color:#64748B;font-size:12px">${s.duration}</span></div>
          <div>${s.time}</div>
        </div>
      </div>
    </div>`).join('')}
</div>` : ''}

<div class="section">
  <div class="section-title">Mood Anak Hari Ini</div>
  <div class="mood-box">
    <div class="mood-emoji">${mood.emoji}</div>
    <div>
      <div class="mood-label">${mood.label}</div>
    </div>
  </div>
</div>

${log.health_notes ? `
<div class="section">
  <div class="section-title">Catatan Kesehatan</div>
  <div class="field-box">${log.health_notes}</div>
</div>` : ''}

<div class="footer">Diunduh dari Aplikasi AnaKu · ${new Date().toLocaleDateString('id-ID')}</div>
</body>
</html>`

  const blob = new Blob([htmlContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => win.print(), 300)
    })
  }
}

// ── Modal Component ───────────────────────────────────────────────────────────
export default function DailyLogDetailModal({ log, childName, att, onClose, autoDownload = false }) {
  // If autoDownload, trigger PDF immediately without showing UI
  useEffect(() => {
    if (autoDownload && log) {
      downloadPDF(log, childName, att)
      onClose()
    }
  }, [])

  useEffect(() => {
    if (log && !autoDownload) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [log, autoDownload])

  if (!log || autoDownload) return null

  const dateLabel = `Laporan ${formatDateFull(log.log_date)}`
  const caregiver = log.caregiver?.full_name ?? 'Tidak diketahui'
  const meals = buildMealInfo(log)
  const sleepSessions = parseSleepSessions(log.activities || [])
  const mood = getMoodConfig(log.mood)

  return (
    <div className="modal-overlay" style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={M.header}>
          <div>
            <h2 style={M.title}>{dateLabel}</h2>
            <p style={M.sub}>Pengasuh : {caregiver}</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {att?.check_in_at && (
                <span style={M.badgeGreen}>Checked In : {fmt12h(att.check_in_at)}</span>
              )}
              {att?.check_out_at && (
                <span style={M.badgeRed}>Checked Out : {fmt12h(att.check_out_at)}</span>
              )}
            </div>
          </div>
          <button style={M.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {/* Scrollable Body */}
        <div style={M.body}>

          {/* Nama Anak */}
          <div style={M.section}>
            <div style={M.sectionLabel}>Nama Anak</div>
            <div style={M.fieldBox}>{childName}</div>
          </div>

          {/* Jadwal Makan */}
          {meals.length > 0 && (
            <div style={M.section}>
              <div style={M.sectionLabel}>Jadwal Makan</div>
              <div style={M.mealBox}>
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <span style={M.mealIcon}>🍱</span>
                  <div>
                    {meals.map((meal, i) => (
                      <div key={i} style={{ marginBottom: i < meals.length - 1 ? '0.75rem' : 0 }}>
                        <div style={M.mealLabel}>{meal.label}</div>
                        <div style={M.mealDesc}>{meal.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Laporan Tidur */}
          {sleepSessions.length > 0 && (
            <div style={M.section}>
              <div style={M.sectionLabel}>Laporan Tidur</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sleepSessions.map((s, i) => (
                  <div key={i} style={M.sleepBox}>
                    <span style={M.sleepIcon}>💤</span>
                    <div style={{ flex: 1 }}>
                      <div style={M.sleepRow}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{s.duration}</div>
                        </div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{s.time}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mood */}
          <div style={M.section}>
            <div style={M.sectionLabel}>Mood Anak Hari Ini</div>
            <div style={{ ...M.moodBox, background: mood.bg }}>
              <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{mood.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B' }}>{mood.label}</div>
              </div>
            </div>
          </div>

          {/* Catatan Kesehatan */}
          {log.health_notes && (
            <div style={M.section}>
              <div style={M.sectionLabel}>Catatan Kesehatan</div>
              <div style={M.fieldBox}>{log.health_notes}</div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div style={M.footer}>
          <button style={M.backBtn} onClick={onClose}>Kembali</button>
          <button style={M.downloadBtn} onClick={() => downloadPDF(log, childName, att)}>
            <Download size={16} /> Unduh PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const M = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: '520px',
    maxHeight: '100%', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid #E2E8F0',
  },
  title: { fontSize: '1.15rem', fontWeight: 700, color: '#1E293B', margin: 0 },
  sub: { fontSize: '0.85rem', color: '#64748B', margin: '0.2rem 0 0' },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#64748B', padding: '0.25rem', flexShrink: 0,
  },
  badgeGreen: {
    background: '#DCFCE7', color: '#15803D', padding: '0.25rem 0.75rem',
    borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
  },
  badgeRed: {
    background: '#FEE2E2', color: '#DC2626', padding: '0.25rem 0.75rem',
    borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
  },
  body: { padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 },
  section: { marginBottom: '1.5rem' },
  sectionLabel: { fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
  fieldBox: {
    border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.75rem 1rem',
    fontWeight: 500, fontSize: '0.95rem', color: '#1E293B',
  },
  mealBox: {
    background: '#EFF6FF', borderRadius: 12, padding: '1rem',
    border: '1.5px solid #BAE6FD',
  },
  mealIcon: { fontSize: '2rem', flexShrink: 0, marginRight: '0.5rem' },
  mealLabel: { fontWeight: 700, fontSize: '0.88rem', color: '#1E40AF', marginBottom: '0.2rem' },
  mealDesc: { fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 },
  sleepBox: {
    border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.75rem 1rem',
    display: 'flex', gap: '0.75rem', alignItems: 'center',
  },
  sleepIcon: { fontSize: '1.5rem', flexShrink: 0 },
  sleepRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flex: 1,
    fontSize: '0.9rem',
  },
  moodBox: {
    borderRadius: 12, padding: '1rem 1.25rem',
    display: 'flex', gap: '1rem', alignItems: 'center',
  },
  footer: {
    padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0',
    display: 'flex', gap: '0.75rem',
  },
  backBtn: {
    flex: 1, padding: '0.75rem', border: '1.5px solid #CBD5E1', background: '#fff',
    borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: '0.9rem',
  },
  downloadBtn: {
    flex: 1, padding: '0.75rem', background: 'var(--accent, #84D6FE)', color: '#fff', border: 'none',
    borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
  },
}
