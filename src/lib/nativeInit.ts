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

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Dark status bar icons on our dark #0a0a0a background
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' })
    await StatusBar.setOverlaysWebView({ overlay: false })
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
}
