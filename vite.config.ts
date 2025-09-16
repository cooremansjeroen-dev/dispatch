
import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      external: ['@capacitor-community/background-geolocation']
    }
  },
  optimizeDeps: {
    exclude: ['@capacitor-community/background-geolocation']
  }
});
