import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// `npm run dev:web` (mode "web") запускает только интерфейс в браузере — удобно для вёрстки.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    mode !== 'web' &&
      electron({
        main: { entry: 'electron/main.ts' },
        preload: { input: 'electron/preload.ts' },
      }),
  ],
  server: { port: 5173, strictPort: true },
}))
