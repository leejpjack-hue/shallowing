import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
      },
      preview: {
        port: 3002,
        host: '0.0.0.0',
        allowedHosts: ['app4.teqcon.uk'],
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
