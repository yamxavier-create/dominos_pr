import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dominopr.app',
  appName: 'Dominó PR',
  webDir: 'dist',
  server: {
    // On native, load from the deployed server instead of local files
    // This ensures socket.io and API calls work without CORS issues
    url: 'https://dominopr.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
