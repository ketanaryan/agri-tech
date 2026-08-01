import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agritech.app',
  appName: 'AgriTech',
  webDir: 'public',
  server: {
    url: 'https://agri-tech-gules.vercel.app',
    cleartext: true
  }
};

export default config;
