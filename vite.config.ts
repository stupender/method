import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // `base` is the URL path the built app is served from once deployed.
  // GitHub Pages serves a project repo at  https://stupender.github.io/method/
  // ...so every asset link in the built site must be prefixed with "/method/".
  // In local dev Vite ignores this and serves from "/", so `npm run dev` is unaffected.
  // If you ever rename the repo, change this string to match the new repo name.
  base: '/method/',
})
