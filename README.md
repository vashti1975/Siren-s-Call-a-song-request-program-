# Siren's Call Song Request Book

A basic, customizable song-request program for Final Fantasy XIV bards and bard bands.

This starter has an **empty catalog**, a simple slate-and-blue theme, and a generic moogle bard chibi. It contains no personal songs, song lists, song durations, filename matches, character images, band logos, private account grants or live-site database snapshots.

## Included

- Owner song management, listener requests, optional in-game names, queue controls, played status and Playing Next.
- Search, filters, sorting, mobile layouts, request opening/closing and optional one-hour performance limits.
- Optional listener profiles, favorites, music-note rewards, milestone stickers and simple collectible reward slots.
- A compact Playing at feature with city choices, venue addresses and pasted FFXIV pin coordinates.
- **Appearance controls** on the owner page: change title, subtitle, colors, logo, background image and default chibi, and optionally enable the animated music background. Images can be uploaded or supplied by URL.
- Optional MidiBard companion source with a configurable deployment URL.
- Database migrations, dependency lockfile, documentation and tests using invented fixtures.

![Default generic chibi](public/default-chibi.png)

## Quick start

Use Node.js 22.13 or newer.

```bash
npm ci
# Copy .dev.vars.example to .dev.vars
npm run db:local
npm run dev
```

Open `http://localhost:5173/`, click Owner sign in, and add your own songs. The bundled local sign-in uses the example development identity. No music or song list is supplied.

```bash
npm run typecheck
npm run test:core
npm run build
```

## Documentation

- [Setup and hosting](SETUP.md)
- [Feature guide](FEATURES.md)
- [Appearance customization](docs/CUSTOMIZATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Rebuilding notes](docs/BACKUP-AND-RESTORE.md)
- [MidiBard companion](docs/MIDIBARD.md)

The web app uses React, TypeScript, Vinext/Vite, Cloudflare Workers and D1. Shared requests and protected owner actions require server hosting; GitHub Pages alone is insufficient. Sites supplies the production ChatGPT authentication integration; another host needs an equivalent trusted identity layer.

This repository is a reusable starter. Uploading it does not modify or redeploy the original owner's songbook. The hosting manifest has no production project ID.

The existing repository LICENSE is retained. Vendored dependency notices stay with their files. The default chibi is a newly generated generic asset; Final Fantasy XIV and associated game elements belong to their respective owners. This is an unofficial fan project.
