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
        main: {
          entry: 'electron/main.ts',
          // electron-updater и electron-log не встраиваем: они идут в приложение как зависимости (node_modules)
          vite: { build: { rolldownOptions: { external: ['electron-updater', 'electron-log', /^electron-log\//] } } },
        },
        preload: { input: 'electron/preload.ts' },
      }),
  ],
  server: { port: 5173, strictPort: true },
}))
