# MAINTENANCE.md — how to run, build, and deploy Method

Practical operations guide. Keep this current when the workflow changes.

## Prerequisites

- Node.js (v22+) and npm. Check: `node -v`, `npm -v`.
- A one-time `npm install` after cloning to fetch dependencies.

## Everyday commands

```bash
npm run dev      # start the local dev server (live reload). Open the printed URL.
npm run build    # type-check (tsc) + production build into dist/
npm run preview  # serve the built dist/ locally, to check the production build
npm run lint     # run ESLint
```

## Deploying to GitHub Pages

```bash
npm run deploy   # runs build, then publishes dist/ to the gh-pages branch
```

`deploy` uses the `gh-pages` package. It builds, then pushes the contents of
`dist/` to a branch called `gh-pages`, which GitHub serves.

**One-time GitHub setup** (already done at project start): the repo exists under
the `stupender` account, and in the repo's *Settings → Pages*, the source is the
`gh-pages` branch. The live URL is https://stupender.github.io/method/.

**Important:** `vite.config.ts` has `base: '/method/'`. This must match the repo
name. If the repo is renamed, update `base` or the deployed site's links break.

## Where things live

```
index.html            the single HTML page the app mounts into
vite.config.ts        Vite config (note the `base` for GitHub Pages)
src/
  main.tsx            entry point — mounts <App> into the page
  App.tsx             top of the React component tree
  index.css           global styles + the colour palette (CSS variables)
  App.css             styles for the current screen
  theory/
    types.ts          THE SCHEMA — all data shapes (types only, no logic)
  data/               theory content (you author this)
    intervals.ts      reusable interval building blocks
    instruments.ts    instrument layouts (guitar, ...)
    tunings.ts        open-string notes per tuning
    scales.ts         scale definitions
    chords.ts         chord-type definitions
  render/             fretboard / TAB / notation drawing (built later)
  audio/              Web Audio playback (built later)
  ui/                 React components and state (built later)
References/           Stu's prior prototypes, designs, and theory PDFs
```

## How to add theory content (the common task)

1. Open the matching file in `src/data/` (e.g. `scales.ts` for a new scale).
2. Copy an existing entry, change the name/id and the interval list.
3. Add it to the lookup object at the bottom of the file (e.g. `SCALES`).
4. It should match a type in `src/theory/types.ts`; if it doesn't, the editor
   will underline the problem. No engine code changes are needed.
