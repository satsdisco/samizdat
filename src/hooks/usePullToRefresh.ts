/**
 * Pull-to-refresh hook for mobile.
 * Detects a downward touch drag when the page is scrolled to the top,
 * and calls the onRefresh callback.
 *
 * On native Android: also listens for Capacitor's App.resume event to
 * refresh stale content when the app comes back to foreground.
 */

import { useEffect, useRef, useCallback } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => void | Promise<void>
  threshold?: number // px to pull before triggering (default 80)
  disabled?: boolean
}

export function usePullToRefresh({ onRefresh, threshold = 150, disabled = false }: PullToRefreshOptions) {
  const touchStartY = useRef(0)
  const touchStartScrollTop = useRef(0)
  const isRefreshing = useRef(false)
  const lastRefreshTime = useRef(0)

  const triggerRefresh = useCallback(async () => {
    if (isRefreshing.current) return
    // Debounce — don't refresh more than once per 5 seconds
    const now = Date.now()
    if (now - lastRefreshTime.current < 5000) return
    lastRefreshTime.current = now
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
      touchStartScrollTop.current = document.documentElement.scrollTop || document.body.scrollTop
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const delta = e.changedTouches[0].clientY - touchStartY.current
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
      // Only trigger if:
      // 1. User was already at the very top when they started the touch
      // 2. Still at the top when they released
      // 3. Pulled down more than the threshold (150px default — much less sensitive)
      if (touchStartScrollTop.current <= 5 && scrollTop <= 5 && delta > threshold) {
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

  // Don't auto-refresh on app resume — it causes slow relay reloads
  // when switching between apps (e.g. returning from signer).
  // Users can pull-to-refresh manually when they want fresh content.
}
