import { useState, useEffect } from 'react'

const LOADING_MESSAGES = [
  'Tuning into relays…',
  'Decentralization takes a sec…',
  'Asking relays nicely…',
  'No servers to blame, just relays…',
  'The underground press is warming up…',
  'Fetching words that can\'t be censored…',
  'Patience. Freedom isn\'t instant.',
  'Relays are thinking about it…',
  'This is what sovereignty feels like…',
  'Gathering dispatches from the network…',
  'The typewriters are still warm…',
  'Negotiating with the decentralized gods…',
  'Almost. The revolution will be relayed.',
  'No CDN, no cache, just truth…',
  'Your ISP can\'t see what we\'re loading…',
  'Smuggling words past the censors…',
  'Decrypting the underground…',
  'The printing press never sleeps…',
  'Relay says: "one moment comrade"…',
  'Freedom of speech loading at relay speed…',
]

export function useLoadingMessage(intervalMs = 3000) {
  const [msg, setMsg] = useState(() =>
    LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
  )
  useEffect(() => {
    const interval = setInterval(() => {
      setMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)])
    }, intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])
  return msg
}
