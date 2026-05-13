export default function DailyStoryCard({ story, childName, generatedAt }) {
  if (!story) return (
    <div style={styles.card}>
      <div style={styles.icon}>📖</div>
      <div style={styles.title}>Cerita Hari Ini</div>
      <p style={styles.empty}>
        Cerita harian akan muncul setelah {childName} check-out dari daycare.
      </p>
    </div>
  )

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.icon}>📖</span>
        <div>
          <div style={styles.title}>Cerita Hari Ini</div>
          {generatedAt && (
            <div style={styles.time}>
              Dibuat {new Date(generatedAt).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
            </div>
          )}
        </div>
      </div>
      <p style={styles.story}>"{story}"</p>
      <div style={styles.footer}>✨ Dibuat oleh AnaKu AI</div>
    </div>
  )
}

const styles = {
  card:   { background:'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
            border:'1px solid rgba(108,99,255,0.3)', borderRadius:'var(--radius-lg)',
            padding:'1.5rem', position:'relative', overflow:'hidden' },
  header: { display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' },
  icon:   { fontSize:'1.75rem' },
  title:  { fontWeight:700, fontSize:'1rem' },
  time:   { color:'var(--text-muted)', fontSize:'0.75rem' },
  story:  { fontSize:'0.95rem', lineHeight:1.8, color:'#C8C8E8',
            fontStyle:'italic', marginBottom:'1rem' },
  empty:  { color:'var(--text-muted)', fontSize:'0.9rem', lineHeight:1.6, marginTop:'0.5rem' },
  footer: { fontSize:'0.75rem', color:'var(--primary)', fontWeight:600 },
}
