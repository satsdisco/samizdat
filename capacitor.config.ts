import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'press.samizdat.app',
  appName: 'Samizdat',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow WebSocket connections to nostr relays (wss://)
    allowNavigation: ['*.samizdat.press', 'nstart.me'],
  },
  android: {
    // Edge-to-edge display — handles notch / gesture bar insets via CSS
    initialFocus: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#c0392b',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0a0a0a',
    },
  },
};

export default config;
