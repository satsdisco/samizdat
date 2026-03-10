/**
 * Pull-to-refresh hook for mobile.
 * Detects a downward touch drag when the page is scrolled to the top,
 * and calls the onRefresh callback.
 *
 * On native Android: also listens for Capacitor's App.resume event to
 * refresh stale content when the app comes back to foreground.
 */

import { useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'

interface PullToRefreshOptions {
  onRefresh: () => void | Promise<void>
  threshold?: number // px to pull before triggering (default 80)
  disabled?: boolean
}

export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false }: PullToRefreshOptions) {
  const touchStartY = useRef(0)
  const isRefreshing = useRef(false)

  const triggerRefresh = useCallback(async () => {
    if (isRefreshing.current) return
    isRefreshing.current = true
    try {
      await onRefresh()
    } finally {
      isRefreshing.current = false
    }
  }, [onRefresh])

  useEffect(() => {
    if (disabled) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const delta = e.changedTouches[0].clientY - touchStartY.current
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
      // Only trigger if pulled down from the very top
      if (delta > threshold && scrollTop <= 0) {
        triggerRefresh()
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [threshold, disabled, triggerRefresh])

  // Also refresh on app resume (foreground) — native only
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || disabled) return
    let cleanup: (() => void) | undefined
    const init = async () => {
      const { App } = await import('@capacitor/app')
      const { remove } = await App.addListener('resume', () => {
        triggerRefresh()
      })
      cleanup = remove
    }
    init().catch(console.warn)
    return () => { cleanup?.() }
  }, [disabled, triggerRefresh])
}
