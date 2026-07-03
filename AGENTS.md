<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hack Line

Local-first digital High Performance Planner. The home page (`/`) is today's planner;
`/planner/[date]` is any other day (reached from history). Backed by Google Calendar and
Todoist (read-only), all in a local SQLite file (`data/hackline.db`). Next.js 16 / React 19 /
Drizzle + better-sqlite3. See `README.md` for setup and how to connect each source.

## Commands

```bash
npm run dev                # http://localhost:3000
npm test                   # vitest (time math / DST edges, ICS parsing)
npx tsc --noEmit           # typecheck
npx drizzle-kit generate   # after ANY edit to lib/db/schema.ts
```

## Architecture map

- **`lib/time.ts`** — the ONLY place date math is allowed. Storage is UTC ISO-8601;
  the planner is keyed by the user's local date in `America/Chicago`. Do not construct
  local dates or format times anywhere else — add a helper here.
- **`lib/sources/`** — one adapter per external system (`google`, `todoist`) behind the
  `CalendarSource` / `TaskSource` interfaces in `types.ts`. Adapters return *normalized*
  shapes; they never touch the DB directly. Google sync also caches per-calendar
  name/color (`google.calendars` in `app_settings`) so the schedule can color events by
  their source calendar.
- **`lib/sync/engine.ts`** — reconciles adapter output into the DB (upsert + delete).
  A new source is wired here by adding it to the `calendarSources` / `taskSources` maps.
- **`lib/sync/scheduler.ts`** — started from `instrumentation.ts` on server boot
  (calendars + tasks every 15 min). `/api/sync` forces a run.
- **`lib/db/`** — `schema.ts` (Drizzle), `index.ts` (singleton connection; runs
  migrations from `drizzle/` on boot). Access via `import { db, tables } from "@/lib/db"`.
- **`lib/planner/prompts.ts`** — HPP prompt catalog. Journal JSON columns in
  `planner_days` are keyed by these prompt IDs, so the catalog is **append-only** —
  never renumber or reuse an ID or you orphan stored answers.
- **`app/`** — routes (`page.tsx` dashboard, `planner/`, `history/`, `settings/`) and
  `api/` route handlers. **`components/`** — grouped by page area.

## Conventions & gotchas

- Schema change workflow: edit `lib/db/schema.ts` → `npx drizzle-kit generate` →
  migration auto-applies next boot (via `migrate()` in `lib/db/index.ts`). Never
  hand-edit files in `drizzle/`.
- The `accounts.domain` column + sync engine are built to accept new domains (a new
  adapter + tables + a dashboard card is the whole extension path). But **do not add a
  fitness feature back unprompted** — it was deliberately removed.
- Native/node-heavy server deps must be listed in `next.config.ts`
  `serverExternalPackages` or the build will try to bundle them.
- Timestamps in the DB are ISO strings, not integers; `all_day`/`completed`/`deleted`
  are 0/1 integer flags.
- Todoist is **read-only**: sync mirrors it in; nothing writes back (no task-creation or
  completion write-back routes — `GET /api/tasks` is the only tasks endpoint). Must-do
  done state lives in the planner day JSON, not Todoist. The must-do picker pulls from
  two curated views (filter/project/section names are constants in
  `lib/sources/todoist.ts`). The API token comes from `TODOIST_API_TOKEN` in `.env.local`;
  `ensureTodoistAccount()` (called from `instrumentation.ts`) provisions the account row on
  boot. Google's per-user refresh token, by contrast, is obtained via OAuth and stored in
  the DB (`accounts.auth_json`).
