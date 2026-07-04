# Hack Line — personal life assistant

A local-first digital [High Performance Planner](https://www.growthday.com/hpp): the home page is
today's planner, backed by a Google Calendar account and Todoist (read-only), with browsable
history. All data stays in a local SQLite file (`data/hackline.db`).

Theme: *aurora over the ice*. Light ("fresh snow") is the default; the nav toggle switches to the
night-sheet dark mode (persisted in localStorage).

## Run it

```bash
nvm use          # needs Node 24 (.nvmrc)
npm install
npm run dev      # http://localhost:3000
```

Background sync starts with the server (calendars and tasks every 15 min);
the "Sync now" button in the Today page header forces a run.

`make` (or `make help`) lists every target — `dev`, `build`, and `test` all run under
the Node version pinned in `.nvmrc`.

### Run it permanently (container — Rancher Desktop / Docker)

```bash
make docker-up      # docker compose up -d --build  → http://localhost:3000
make docker-logs    # tail container logs
make docker-down    # stop and remove
```

`restart: unless-stopped` in `docker-compose.yml` brings the container back on boot
(as long as Rancher Desktop launches at login) and after crashes. Notes:

- Secrets come from `.env.local` at runtime (via `env_file` in `docker-compose.yml`);
  they're never baked into the image.
- Your existing SQLite DB is bind-mounted (`./data:/app/data`), so connected accounts
  and journal history carry over — no reconnecting Google, no lost entries.
- The container binds **loopback only** (`127.0.0.1`), so the auth-less planner is
  reachable from this Mac and nowhere on the LAN.
- **Host port** is `HACKLINE_PORT` in `.env` (default 3000; the container always listens
  on 3000 internally). If you change it, add
  `http://localhost:<HACKLINE_PORT>/api/oauth/google/callback` as an authorized redirect
  URI in Google Cloud Console — otherwise *connecting* a Google account fails. Already-connected
  accounts keep syncing regardless (the redirect URI is only used at connect time).
- Sync runs inside the container just like the local server. Don't run the container and a
  local `npm run dev` at the same time — they'd write the same DB.

Planner keyboard shortcuts: `←`/`→` (or `j`/`k`) move between days, `t` jumps to today.

## Connect your sources

### Todoist (2 min)

1. Todoist → Settings → Integrations → Developer → copy the API token.
2. Put it in `.env.local` as `TODOIST_API_TOKEN=…` and restart. Todoist connects automatically.

Todoist is **read-only**: the app mirrors it via sync but never writes back (no creating or
completing tasks in Todoist). Checking a must-do off is local to the planner.

The planner's "Tasks that absolutely must be done today" picker pulls from two curated Todoist
views (names are constants in `lib/sources/todoist.ts`):

- the saved filter **"Personal top priorities"**, and
- **Work - Todo → Top Priorities** (the board column).

### Google Calendar (~15 min, one time)

1. [console.cloud.google.com](https://console.cloud.google.com) → create project (e.g. `hackline`).
2. APIs & Services → Library → enable **Google Calendar API**.
3. APIs & Services → OAuth consent screen → External → fill the three required fields.
   **Then click "Publish app"** (leave it unverified) — in Testing mode refresh tokens expire every 7 days.
4. Credentials → Create credentials → OAuth client ID → **Web application** →
   authorized redirect URI: `http://localhost:3000/api/oauth/google/callback`.
5. Put the credentials in `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
6. Restart `npm run dev`, then App → Settings → **Connect Google account**.
   You'll see Google's "unverified app" warning — Advanced → continue (it's your own app).
7. Use **Choose calendars…** on the account to pick which of its calendars sync. The schedule
   colors each event by its source calendar (a legend shows up when more than one is present).

## Development

```bash
npm test             # vitest — time math (DST edges)
npx tsc --noEmit     # typecheck
npx drizzle-kit generate   # after editing lib/db/schema.ts
```

- **`lib/time.ts`** is the only place date math lives (storage is UTC; planner keyed by America/Chicago dates).
- **`lib/sources/`** — adapters (`google`, `todoist`) behind the interfaces in `types.ts`.
- **`lib/planner/prompts.ts`** — the HPP prompt catalog; journal JSON is keyed by these IDs (append-only).
- Adding a future domain (fitness, finance): new adapter + tables + a dashboard card; the
  `accounts.domain` column and sync engine already accommodate it.
