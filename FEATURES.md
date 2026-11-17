# Songbook features

## Listeners

- Search title, artist/source, set or notes; combine artist/set/played-status filters and sorting.
- Request without an account. The in-game name field is optional.
- See Playing now, Playing Next (oldest waiting request), and this-show requested/played labels.
- See closed-request and one-hour-show status. The server enforces settings even for older open listener pages.
- See a slim Playing at line containing world, address and optional zone coordinates, with Copy. Location changes use the five-second catalog refresh.
- Optionally sign in for favorites, request milestones, chibi awards, earned music notes, special reward purchases and freely placed stickers.
- Send feedback at the bottom; only the owner reads it.
- Use the normal or embedded page. The music background has motion controls and reduced-motion support.

## Owner

- Change title, subtitle, logo, page/panel/accent/text colors, background image and default chibi in the Appearance panel. Upload small images or use local/HTTPS URLs.

- Add/edit songs and lengths. Removal requires confirmation while retaining records needed for history/totals/rewards.
- View pending requests oldest first, with optional requester names and timestamps. Mark played, undo the latest clear or mark an unrequested song played.
- Phone/touch played actions ask for confirmation. Coordinated polling prevents older refreshes from clearing waiting requests during writes.
- Open/close requests. Limit the show to one hour using played plus queued duration, including non-request songs. Missing durations pause time-limited requests until resolved.
- Start a new show with confirmation: current-show labels, queue visibility and show time reset; lifetime history and independent settings remain saved.
- Reset lifetime totals with a separate confirmation without deleting requests, profiles, matches or the active show.
- Pair/revoke the MidiBard companion, recover/correct filename matches and choose whether names appear in `/s` announcements.
- Read/archive feedback. Use search shortcuts and performance view. `/` focuses search, Escape clears it, and P toggles performance view outside inputs.

## Playing at

Open the collapsed **Playing at** control at the top of the owner page:

1. Choose City / open-world spot or Venue.
2. Pick a city, use Random city, or select/create a saved venue.
3. Enter data center, world, name and zone. Venues need their address: district, ward, plot, apartment/room as applicable.
4. Optionally paste the expanded FFXIV chat pin and choose Use pin, or enter X/Y manually.
5. Choose Show location to publish. Save venue stores an address privately for reuse. Hide location removes the public line.

Cities: Limsa Lominsa, Gridania, Ul'dah, Ishgard, Kugane, the Crystarium, Old Sharlayan and Tuliyollal. Random city changes the draft; publication remains an owner action.

`<flag>`/`<pos>` alone contain no usable coordinates outside FFXIV. Paste the expanded zone/X/Y text. The browser displays/copies plain text; it cannot create a native clickable in-game flag or read live character position. Saved venues persist across show resets and restarts. Only the published selection is public.

## Persistence and privacy

D1 holds shared requests, show state, song edits/lengths, matching data, profiles, favorites and rewards. Owner APIs verify identity, and writes check origin. Guest requests have idempotent IDs and basic cookie rate limits. Requester names stay private except optional in-game announcements.

The companion uses a revocable pairing key stored as a hash on the server. Retries do not replay newer requests or repeat announcements. A stale connection clears Playing now after about 20 seconds.

The starter contains no personal catalog or artwork. The default generic chibi is reused by the basic reward slots, and can be replaced through Appearance.
