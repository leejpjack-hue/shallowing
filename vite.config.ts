import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
        proxy: {
          '/api': 'http://localhost:3003',
        },
      },
      preview: {
        port: 3002,
        host: '0.0.0.0',
        allowedHosts: ['app4.teqcon.uk'],
      },
      plugins: [react()],
      // NOTE: no `define` for API_KEY — all Gemini calls go through /api (server.cjs),
      // so no key is shipped to the browser bundle.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        emptyOutDir: false,
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            novels: path.resolve(__dirname, 'novels.html'),
          },
        },
      },
    };
});
