/**
 * Native Android initialization.
 * Called once at app startup to configure:
 * - StatusBar: dark overlay for the Samizdat dark theme
 * - SplashScreen: hide after web content is ready
 *
 * All calls are no-ops on web (Capacitor stubs handle this).
 */

import { Capacitor } from '@capacitor/core'

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // Add class so CSS can target native-only styles without breakpoint guessing
  document.body.classList.add('is-native-android')

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Overlay mode: status bar overlaps WebView, CSS env(safe-area-inset-top) gives real height
    await StatusBar.setOverlaysWebView({ overlay: true })
    // Light style = dark icons (for light editor/press backgrounds)
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#00000000' })

    // Read actual status bar height and inject as CSS variable
    // This is more reliable than env(safe-area-inset-top) on some Android versions
    try {
      const info = await StatusBar.getInfo()
      const height = (info as any).height ?? 48
      document.documentElement.style.setProperty('--status-bar-height', `${height}px`)
    } catch {
      // Fallback: typical Android status bar is 24-48dp
      document.documentElement.style.setProperty('--status-bar-height', '48px')
    }
  } catch (e) {
    console.warn('[NativeInit] StatusBar setup failed:', e)
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    // Hide the splash once the JS bundle has loaded and this runs
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch (e) {
    console.warn('[NativeInit] SplashScreen hide failed:', e)
  }

  // Initialize NIP-55 deep link fallback for signer callback URLs
  try {
    const { initDeepLinkFallback } = await import('./androidSigner')
    await initDeepLinkFallback()
  } catch (e) {
    console.warn('[NativeInit] Signer deep link fallback init failed:', e)
  }
}
