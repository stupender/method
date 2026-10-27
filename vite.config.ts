import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // `base` is the URL path the built app is served from once deployed.
  // The app lives at the ROOT of its own address:
  //   https://fretboardconstellations.beingsound.studio/
  // so asset links start at "/". (It used to be "/method/", when GitHub Pages
  // served it at stupender.github.io/method/ — that address now redirects
  // here, because public/CNAME gives the repo's Pages site its own domain.)
  // In local dev Vite serves from "/" either way, so `npm run dev` is unaffected.
  base: '/',
})
