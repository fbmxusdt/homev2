import { useState, useEffect } from 'react'

export function useCountdown(targetTimestamp) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!targetTimestamp) { setTimeLeft(0); return }

    const update = () => {
      const diff = targetTimestamp - Math.floor(Date.now() / 1000)
      setTimeLeft(Math.max(0, diff))
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [targetTimestamp])

  const hours = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  const formatted =
    timeLeft <= 0
      ? null
      : timeLeft < 60
      ? `${seconds}s`
      : timeLeft < 3600
      ? `${minutes}m ${seconds}s`
      : `${hours}h ${minutes}m ${seconds}s`

  return { timeLeft, formatted, isActive: timeLeft > 0 }
}
