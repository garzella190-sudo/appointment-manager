import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autoscuola.agendaguide',
  appName: 'Agenda Guide',
  webDir: 'public',
  server: {
    url: 'https://agenda-guide-manu.vercel.app',
    cleartext: true
  }
};

export default config;
