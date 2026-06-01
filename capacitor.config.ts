import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vibtribe.app',
  appName: 'VibTribe',
  webDir: 'dist',
  server: {
    url: 'http://192.168.29.198:8080',
    cleartext: true
  }
};

export default config;