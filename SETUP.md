# Set up or rebuild the songbook

## 1. Install

Install Node.js 22.13+ and Git. Clone using an account with access to this private repository:

```bash
git clone https://github.com/vashti1975/Siren-s-Call-a-song-request-program-.git
cd Siren-s-Call-a-song-request-program-
npm ci
```

The lockfile preserves dependency versions. Dependencies, build output and local database files are excluded from Git.

## 2. Local owner access

Copy `.dev.vars.example` to `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

On Windows PowerShell use `Copy-Item .dev.vars.example .dev.vars`.

The example contains only the development identity `seedy@sites.test`. The bundled local sign-in plugin supplies that identity after you click **Owner sign in** on localhost. The mock sign-in is restricted to loopback hosts and absent from production builds. ChatGPT-managed preview environments can use a different identity.

Production owner access uses `SONGBOOK_OWNER_EMAIL`, checked against the authenticated user's email in `lib/owner.ts`. Set the real secret through your hosting provider. Never commit a real `.dev.vars`, `.env`, pairing key or provider credential.

## 3. Create a local database

```bash
npm run db:local
```

This applies the schema migrations in `drizzle/` to a local database using `wrangler.local.jsonc`. It always uses `--local` and stores state under `.wrangler/state`. The schema contains no song seed. Open the owner page and use Add song to build a new catalog.

## 4. Run

```bash
npm run dev
```

Open `http://localhost:5173/` and click **Owner sign in**. Open `/requests` for listeners or `/requests/embed` for the compact embedded page. A fresh database has no pending requests or listener profiles. Generate a new companion connection key from this deployment; existing production keys are not included.

The portable runner uses Vinext. ChatGPT-managed Linux workspaces use their configured execution profile.

## 5. Test and build

```bash
npm run typecheck
npm run test:core
npm run build
```

The web/database suites use isolated test databases. They do not reset production data. Individual checks remain under `scripts/test-*.mjs`; `test-songbook.mjs` needs `--experimental-vm-modules` when run directly. Build output includes `dist/server/index.js` and client assets under `dist/`.

## 6. Host

This application needs a server and shared D1 database. GitHub Pages alone cannot run its protected APIs or request queue.

The `.openai/hosting.json` declares the `DB` binding and has no production project ID. To publish with Sites, create a new Site, persist its returned project ID, bind a new D1 database as `DB`, apply schema migrations, configure Sign in with ChatGPT and set `SONGBOOK_OWNER_EMAIL`. Build/package/deploy through the Sites workflow. A GitHub commit does not publish the website. R2 is not required.

For independent Cloudflare hosting, supply the Worker/client assets, D1 binding, production secrets and a trusted authentication integration. `app/chatgpt-auth.ts` expects identity headers authenticated by Sites. Do not trust identity headers supplied directly by public callers. `wrangler.local.jsonc` is a local database helper, not a complete independent production/authentication configuration.

This is a new starter, not a deployment backup. Keep personal catalogs outside this repository. For an existing deployment, preserve its runtime database when changing source.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Owner controls unavailable locally | Copy example variables, restart, use localhost/127.0.0.1 and click Owner sign in. |
| Missing database tables | Run `npm run db:local` from the repository root. |
| Empty song list | Expected: use Add song on the owner page. Songs and saved matches are excluded. |
| Production owner receives 403 | Verify trusted identity and `SONGBOOK_OWNER_EMAIL`. |
| New deployment has no requests/profiles | Runtime records are separate from this source backup. |
| Companion disconnected | Pair it to the intended deployment and check `/songbooksync status`. |
