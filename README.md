# Method

An interactive, in-browser music-theory and guitar-learning tool. A living
textbook: you learn by **seeing** the fretboard, **hearing** the sound, and
**playing** with it — not by reading explanations. In the spirit of Ableton's
Learning Music / Learning Synths.

**Thesis:** theory and technique exist to free expression. One transferable
pattern — a *method* — applied across the instrument. The less you have to
think, the more you can play.

## Live

Deployed via GitHub Pages: https://stupender.github.io/method/

## Tech

TypeScript + React + Vite + Web Audio API. VexFlow for standard notation
(added later). Plain CSS. No backend.

## The core idea: a data-driven engine

Method is an **engine that renders theory data**. The theory content (scales,
chords, voicings, tunings, instruments) lives in plain data files under
`src/data/`. The engine reads that data and draws/plays it. To add a scale, a
chord, a tuning, or even a whole instrument, you **add a data file** — you don't
touch the engine. See [CLAUDE.md](CLAUDE.md) for the architecture and
[MAINTENANCE.md](MAINTENANCE.md) for how to run and deploy.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm run deploy   # publish to GitHub Pages
```

## Status

Built across a series of sessions. Currently: **Session 3 — scales, intervals &
audio** complete (pick a root and the major scale realises across the neck with
correct enharmonic spelling and degree labels; tap any note or play the whole
scale via Web Audio). Next: chords (triads + 7ths) with voicings + TAB.
