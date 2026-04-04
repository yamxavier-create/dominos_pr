import { Capacitor } from '@capacitor/core'

// On native, API calls need the full server URL
// On web (dev/prod), relative paths work via proxy or same-origin
export const API_BASE = Capacitor.isNativePlatform()
  ? 'https://server-production-b2a8.up.railway.app'
  : (import.meta.env.VITE_API_URL || '')
