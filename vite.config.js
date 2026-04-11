import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { lobbyPlugin } from './vite-plugin-lobby.js'

export default defineConfig({
  plugins: [vue(), lobbyPlugin()],
})
