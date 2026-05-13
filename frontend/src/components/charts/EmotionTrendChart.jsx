import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const SENTIMENT_COLORS = { positif:'#43D9AD', netral:'#6C63FF', negatif:'#FF6584' }
const SENTIMENT_LABELS = { positif:'😄 Ceria', netral:'😊 Normal', negatif:'😤 Rewel' }

export default function EmotionTrendChart({ data }) {
  // data: [{log_date, sentiment_label, mood}]
  const chartData = data.map(d => ({
    date: new Date(d.log_date).toLocaleDateString('id-ID', { weekday:'short', day:'numeric' }),
    sentimen: d.sentiment_label || 'netral',
    nilai: d.sentiment_label === 'positif' ? 3 : d.sentiment_label === 'netral' ? 2 : 1,
    color: SENTIMENT_COLORS[d.sentiment_label] || '#6C63FF',
    label: SENTIMENT_LABELS[d.sentiment_label] || '😊 Normal',
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)',
        borderRadius:'8px', padding:'0.75rem', fontSize:'0.85rem' }}>
        <div style={{ fontWeight:600 }}>{d.date}</div>
        <div style={{ color: d.color, marginTop:'0.25rem' }}>{d.label}</div>
      </div>
    )
  }

  return (
    <div style={{ width:'100%', height:'200px' }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top:5, right:5, bottom:5, left:-20 }}>
          <XAxis dataKey="date" tick={{ fill:'#8888AA', fontSize:11 }} />
          <YAxis domain={[0,4]} ticks={[1,2,3]}
            tickFormatter={v => v===3?'😄':v===2?'😊':'😤'}
            tick={{ fontSize:14 }} />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
          <Bar dataKey="nilai" radius={[6,6,0,0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
