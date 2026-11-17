# Architecture

React clients call route handlers in a Cloudflare Worker, which reads/writes the `DB` D1 binding. Most state is server-backed. Owner favorites and performance-view preferences also use local storage.

`lib/songs.ts` exports the song types, filter helpers and an intentionally empty base array. `lib/catalog.ts` overlays database edits/removal markers and lengths. Stable song IDs preserve request, match and reward associations; cross-set title/artist identities share relevant show status.

| Path | Purpose |
| --- | --- |
| `app/page.tsx`, `app/songbook-client.tsx` | Authenticated owner page |
| `app/requester-songbook.tsx`, `app/requests/` | Listener and embedded pages |
| `app/owner-playing-location.tsx`, `app/playing-location.tsx` | Compact location controls/display |
| `app/listener-profile.tsx`, `app/special-rewards.tsx`, `app/listener-page-stickers.tsx` | Profiles, rewards and placement |
| `app/globals.css`, `app/listener-music-background.tsx` | Branding, responsive styles and motion |
| `app/midibard-sync.tsx`, `bridge/` | Pairing/matching controls and C# companion |
| `lib/show.ts`, `lib/playback.ts`, `lib/show-budget.ts` | Show status, playback and one-hour budget |
| `lib/request-refresh.ts`, `lib/request-history.ts` | Coordinated polling and counting/reset periods |
| `lib/playing-location.ts`, `lib/playing-location-store.ts` | Pin parsing, formatting and storage |
| `lib/owner.ts`, `app/chatgpt-auth.ts` | Owner checks and trusted identity |
| `db/schema.ts`, `drizzle/` | Schema and ordered migrations |
| `public/` | Generic chibi and companion source ZIP |
| `scripts/test-*.mjs`, `bridge-tests/` | Web/database and companion checks |

## APIs

| Route | Responsibility |
| --- | --- |
| `/api/catalog` | Public songs, show flags, next song, availability/budget and published location |
| `/api/request` | Guest/signed-in requests with optional name, throttling and idempotency |
| `/api/manage` | Owner catalog, queue, counts, resets and settings |
| `/api/appearance` | Public appearance settings; owner-only, same-origin updates |
| `/api/location` | Owner published location and saved venues |
| `/api/durations` | Owner duration import/management |
| `/api/feedback` | Listener feedback submission and owner management |
| `/api/listener` | Current listener's profile, favorites and rewards |
| `/api/midibard` | Authenticated companion playback events |
| `/api/midibard/manage` | Owner pairing/revocation and filename matching |

## Storage

Migrations cover catalog overrides, requests, current-show/play history, companion state, durations, feedback, profiles, favorites, note awards and reward purchases. Some legacy companion table initialization is also handled idempotently by `lib/midibard.ts`.

`show_state` is the key/value table. The `appearance` key holds customizable branding/colors and image paths or small image data URLs. It stores current show and request settings plus `playing-location` JSON and `playing-venue:<uuid>` records. New-show reset changes only the current-show key.

No database snapshot or personal repertoire is included. Automated tests inject invented fixtures independently of the empty production catalog.

## Identity and hosting

Sites authenticates ChatGPT identity headers. Protected routes check the authenticated email against `SONGBOOK_OWNER_EMAIL`; public listener access does not grant owner access. Another provider must supply an equivalent trusted identity boundary.

`vite.config.ts` connects Vinext, Sites, the Cloudflare Worker and D1. `worker/index.ts` wraps the Vinext handler. `scripts/run-framework.mjs` selects portable/managed execution. Builds emit `dist/server/index.js` and client assets.

`.openai/hosting.json` declares storage without a production project ID. Secrets are configured outside source control. GitHub publication and website deployment are separate operations.
