// React hook for automatic zap verification
import { useState, useEffect, useCallback, useRef } from 'react'
import { verifyReaderZap, hasRecentZap, type ZapVerificationConfig } from '../lib/zapVerification'

interface AutoZapVerificationState {
  isVerifying: boolean
  isUnlocked: boolean
  error: string | null
  lastCheckTime: number | null
}

interface UseAutoZapVerificationOptions {
  enabled: boolean
  readerPubkey?: string
  checkInterval?: number // milliseconds between checks (default 30s)
  onUnlock?: () => void
}

/**
 * Hook for automatic zap verification with page focus detection
 */
export function useAutoZapVerification(
  config: Omit<ZapVerificationConfig, 'readerPubkey'>,
  options: UseAutoZapVerificationOptions
) {
  const [state, setState] = useState<AutoZapVerificationState>({
    isVerifying: false,
    isUnlocked: false,
    error: null,
    lastCheckTime: null
  })

  const intervalRef = useRef<number | undefined>(undefined)
  const lastFocusTime = useRef<number>(Date.now())

  // Check for zaps
  const checkForZaps = useCallback(async () => {
    if (!options.enabled || state.isUnlocked || state.isVerifying) return

    setState(prev => ({ ...prev, isVerifying: true, error: null }))

    try {
      let hasValidZap = false

      // If we have reader's pubkey, verify specifically for them
      if (options.readerPubkey) {
        hasValidZap = await verifyReaderZap({
          ...config,
          readerPubkey: options.readerPubkey
        })
      } else {
        // Fallback: check for any recent zap
        hasValidZap = await hasRecentZap(config)
      }

      if (hasValidZap) {
        setState(prev => ({ 
          ...prev, 
          isUnlocked: true, 
          isVerifying: false,
          lastCheckTime: Date.now()
        }))
        options.onUnlock?.()
      } else {
        setState(prev => ({ 
          ...prev, 
          isVerifying: false,
          lastCheckTime: Date.now()
        }))
      }

    } catch (error) {
      console.error('Zap verification error:', error)
      setState(prev => ({ 
        ...prev, 
        isVerifying: false, 
        error: error instanceof Error ? error.message : 'Verification failed',
        lastCheckTime: Date.now()
      }))
    }
  }, [config, options, state.isUnlocked])

  // Handle page focus (user returning from wallet)
  useEffect(() => {
    if (!options.enabled) return

    const handleFocus = () => {
      const now = Date.now()
      const timeSinceFocus = now - lastFocusTime.current
      
      // Only check if user was away for >30 seconds (likely went to wallet)
      if (timeSinceFocus > 30000) {
        console.log('🔍 Page focused after being away - checking for zaps...')
        checkForZaps()
      }
      
      lastFocusTime.current = now
    }

    const handleBlur = () => {
      lastFocusTime.current = Date.now()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [checkForZaps, options.enabled])

  // Periodic background checking (disabled by default to prevent flashing)
  useEffect(() => {
    if (!options.enabled || state.isUnlocked) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
      return
    }

    // Only enable background checking if explicitly requested
    // For now, rely on focus detection and manual checks only
    const enableBackgroundCheck = false // TODO: make this configurable
    
    if (enableBackgroundCheck) {
      const interval = options.checkInterval || 60000 // default 60s
      
      intervalRef.current = window.setInterval(() => {
        checkForZaps()
      }, interval)
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
    }
  }, [checkForZaps, options.enabled, options.checkInterval, state.isUnlocked])

  // Manual verification trigger
  const manualCheck = useCallback(() => {
    checkForZaps()
  }, [checkForZaps])

  return {
    ...state,
    manualCheck
  }
}