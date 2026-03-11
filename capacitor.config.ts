import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hayatetv.app',
  appName: 'HayateTV',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
