import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/toy-scrabble/',
  server: {
    host: true, // 他デバイス（スマホ等）からのアクセスを許可
  },
});
