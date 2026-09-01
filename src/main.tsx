import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ADD TO HOME SCREEN. Registering the service worker (public/sw.js) is what
// makes a browser willing to install this as an app; the manifest in
// index.html is the other half. See the comments in sw.js for what it does.
//
// AFTER `load`, deliberately: registering during startup competes with the
// app's own first paint for the same connection, and there is nothing the
// worker can do for a visitor who hasn't finished arriving yet.
//
// BASE_URL rather than '/': this is served from a sub-path (/method/), so the
// worker has to be registered at that path or its scope won't cover the app.
// Vite substitutes the value at build time, so it stays right if the path
// changes.
//
// A failure here is not worth surfacing — it means no offline and no install
// prompt, and the app itself works exactly as before. Common in a private
// window, and over plain http, where service workers aren't allowed at all.
// PRODUCTION ONLY. A cache that serves the last thing it saw is exactly wrong
// while you're editing: the dev server pushes a change, the worker answers
// from its cache, and you're looking at code you already replaced. It cost an
// afternoon's confusion the first time. In development the app simply runs
// without one; nothing else differs.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        /* no offline support here; the app is unaffected */
      })
  })
} else if ('serviceWorker' in navigator) {
  // And clean up after any worker a previous run of the dev server registered,
  // which would otherwise keep answering from its cache forever.
  navigator.serviceWorker.getRegistrations?.().then((rs) => {
    rs.forEach((r) => r.unregister())
  })
}
