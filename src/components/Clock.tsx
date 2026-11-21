import { useEffect, useState, type CSSProperties } from 'react'

interface Props {
  showTime: boolean
  showDate: boolean
  hour12: boolean
  /** Multiplier for the clock's size. */
  scale: number
}

function formatTime(d: Date, hour12: boolean) {
  const m = String(d.getMinutes()).padStart(2, '0')
  if (!hour12) return `${String(d.getHours()).padStart(2, '0')}:${m}`
  // Lock-screen style: no leading zero, no AM/PM.
  return `${d.getHours() % 12 || 12}:${m}`
}

export function Clock({ showTime, showDate, hour12, scale }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!showTime && !showDate) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [showTime, showDate])

  if (!showTime && !showDate) return null

  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')

  return (
    <div className="clock" style={{ '--clock-scale': scale } as CSSProperties}>
      {showDate && <div className="clock-date">{date}</div>}
      {showTime && <div className="clock-time">{formatTime(now, hour12)}</div>}
    </div>
  )
}
