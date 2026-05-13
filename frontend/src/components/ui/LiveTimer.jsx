import { useState, useEffect } from 'react'

export default function LiveTimer({ startTimeISO }) {
  const [elapsed, setElapsed] = useState('00 : 00 : 00')

  useEffect(() => {
    if (!startTimeISO) return

    const start = new Date(startTimeISO).getTime()

    const update = () => {
      const now = new Date().getTime()
      const diff = Math.max(0, Math.floor((now - start) / 1000))
      
      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60

      const h = hours.toString().padStart(2, '0')
      const m = minutes.toString().padStart(2, '0')
      const s = seconds.toString().padStart(2, '0')

      setElapsed(`${h} : ${m} : ${s}`)
    }

    update() // initial call
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startTimeISO])

  if (!startTimeISO) return <span>-</span>

  return <span>{elapsed}</span>
}
