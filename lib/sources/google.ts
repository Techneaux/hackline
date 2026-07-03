import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { getJsonSetting, setSetting } from "@/lib/db/settings";
import type { Account } from "@/lib/db/schema";
import type { CalendarSource, CalendarSyncResult, NormalizedEvent, SyncWindow } from "./types";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

export function oauthClient(redirectUri?: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local");
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

interface GoogleAuth {
  refreshToken: string;
  /** which calendars to sync; defaults to ['primary'] */
  calendarIds?: string[];
}

interface GoogleEventTime {
  date?: string; // all-day
  dateTime?: string;
  timeZone?: string;
}

interface GoogleEvent {
  id: string;
  status: string; // confirmed | tentative | cancelled
  eventType?: string; // default | workingLocation | outOfOffice | focusTime | birthday | …
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  attendees?: { email?: string; displayName?: string; self?: boolean; responseStatus?: string }[];
}

function authFor(account: Account): { client: OAuth2Client; calendarIds: string[] } {
  const auth = JSON.parse(account.authJson ?? "{}") as GoogleAuth;
  if (!auth.refreshToken) throw new Error("Google account has no refresh token — reconnect it");
  const client = oauthClient();
  client.setCredentials({ refresh_token: auth.refreshToken });
  return { client, calendarIds: auth.calendarIds?.length ? auth.calendarIds : ["primary"] };
}

export function normalizeGoogleEvent(e: GoogleEvent, calendarId: string): NormalizedEvent | null {
  const start = e.start?.dateTime ?? e.start?.date;
  const end = e.end?.dateTime ?? e.end?.date;
  if (!start || !end) return null;
  const allDay = Boolean(e.start?.date);
  const toIso = (s: string) => (allDay ? new Date(`${s}T00:00:00Z`).toISOString() : new Date(s).toISOString());
  return {
    externalId: `${calendarId}:${e.id}`,
    calendarId,
    title: e.summary ?? "(no title)",
    description: e.description ?? null,
    location: e.location ?? null,
    startTs: toIso(start),
    endTs: toIso(end),
    allDay,
    status: (e.status as NormalizedEvent["status"]) ?? "confirmed",
    attendees: e.attendees?.map((a) => ({
      email: a.email,
      name: a.displayName,
      self: a.self,
      responseStatus: a.responseStatus,
    })),
  };
}

/** Cursor format: JSON map of calendarId -> syncToken. */
type CursorMap = Record<string, string>;

export const googleSource: CalendarSource = {
  kind: "google",

  async sync(account: Account, cursor: string | null, window: SyncWindow): Promise<CalendarSyncResult> {
    const { client, calendarIds } = authFor(account);
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Could not refresh Google access token");

    // Best-effort: refresh the per-calendar names + colors the schedule uses to
    // color events. Never let this fail the actual event sync.
    try {
      persistCalendarMeta(account.id, await fetchCalendarList(token));
    } catch (err) {
      console.error("[google] calendar meta refresh failed:", err);
    }

    const cursors: CursorMap = cursor ? JSON.parse(cursor) : {};
    const nextCursors: CursorMap = {};
    const events: NormalizedEvent[] = [];
    const deletedIds: string[] = [];
    // Calendars fetched without a syncToken (initial sync or 410-expired token)
    // get snapshot semantics: the engine delete-and-replaces their window so
    // remote deletions during the gap don't leave ghost events.
    const replacedCalendarIds: string[] = [];

    for (const calendarId of calendarIds) {
      let pageToken: string | undefined;
      let syncToken = cursors[calendarId];
      let fullFetch = !syncToken;

      const fetchPage = async (params: URLSearchParams): Promise<Response> =>
        fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

      do {
        const params = new URLSearchParams({ maxResults: "250", singleEvents: "true" });
        if (pageToken) params.set("pageToken", pageToken);
        else if (syncToken) params.set("syncToken", syncToken);
        else {
          params.set("timeMin", window.from.toISOString());
          params.set("timeMax", window.to.toISOString());
        }

        let res = await fetchPage(params);
        if (res.status === 410 && syncToken) {
          // Expired sync token: restart this calendar with a full windowed fetch.
          syncToken = "";
          fullFetch = true;
          pageToken = undefined;
          const retry = new URLSearchParams({
            maxResults: "250",
            singleEvents: "true",
            timeMin: window.from.toISOString(),
            timeMax: window.to.toISOString(),
          });
          res = await fetchPage(retry);
        }
        if (!res.ok) {
          throw new Error(`Google events.list(${calendarId}) failed: ${res.status} ${await res.text()}`);
        }
        const data = (await res.json()) as {
          items?: GoogleEvent[];
          nextPageToken?: string;
          nextSyncToken?: string;
        };
        for (const item of data.items ?? []) {
          if (item.status === "cancelled" || item.eventType === "workingLocation") {
            // "workingLocation" events (Home/Office) are a Calendar UI feature,
            // not real schedule items — drop them (and purge any already synced).
            deletedIds.push(`${calendarId}:${item.id}`);
          } else {
            const n = normalizeGoogleEvent(item, calendarId);
            if (n) events.push(n);
          }
        }
        pageToken = data.nextPageToken;
        if (data.nextSyncToken) nextCursors[calendarId] = data.nextSyncToken;
      } while (pageToken);

      if (!nextCursors[calendarId] && cursors[calendarId] && !fullFetch) {
        nextCursors[calendarId] = cursors[calendarId];
      }
      if (fullFetch) replacedCalendarIds.push(calendarId);
    }

    return {
      events,
      deletedIds, // incremental deletes arrive as cancelled items
      nextCursor: JSON.stringify(nextCursors),
      full: false, // never account-wide: other calendars may be incremental
      replacedCalendarIds,
    };
  },
};

export interface GoogleCalendarInfo {
  id: string; // 'primary' for the primary calendar (normalized)
  summary: string;
  primary: boolean;
  color: string | null;
  accessRole: string;
}

async function fetchCalendarList(token: string): Promise<GoogleCalendarInfo[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`calendarList failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    items?: {
      id: string;
      summary: string;
      summaryOverride?: string; // the name YOU gave a shared calendar in your list
      primary?: boolean;
      backgroundColor?: string;
      accessRole: string;
    }[];
  };
  return (data.items ?? []).map((i) => ({
    id: i.primary ? "primary" : i.id,
    // Prefer the user's own name for the calendar over the owner's title.
    summary: i.summaryOverride ?? i.summary,
    primary: Boolean(i.primary),
    color: i.backgroundColor ?? null,
    accessRole: i.accessRole,
  }));
}

/** All calendars visible to the account, with the primary normalized to 'primary'. */
export async function listGoogleCalendars(account: Account): Promise<GoogleCalendarInfo[]> {
  const { client } = authFor(account);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not refresh Google access token");
  return fetchCalendarList(token);
}

/** Per-calendar name + color, cached so the schedule can color events by calendar. */
export interface StoredCalendar {
  accountId: number;
  id: string; // 'primary' or the calendar id, matching calendarEvents.calendarId
  summary: string;
  color: string | null;
}

const CALENDARS_KEY = "google.calendars";

export function storedCalendars(): StoredCalendar[] {
  return getJsonSetting<StoredCalendar[]>(CALENDARS_KEY, []);
}

/** Replace this account's cached calendar metadata, leaving other accounts' intact. */
function persistCalendarMeta(accountId: number, calendars: GoogleCalendarInfo[]): void {
  const others = storedCalendars().filter((c) => c.accountId !== accountId);
  const mine = calendars.map((c) => ({
    accountId,
    id: c.id,
    summary: c.summary,
    color: c.color,
  }));
  setSetting(CALENDARS_KEY, JSON.stringify([...others, ...mine]));
}

/** Store tokens after the OAuth callback; creates or updates the account row. */
export async function saveGoogleAccount(params: {
  refreshToken: string;
  email: string | null;
  label?: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const existing = params.email
    ? db
        .select()
        .from(tables.accounts)
        .where(eq(tables.accounts.identity, params.email))
        .all()
        .find((a) => a.kind === "google")
    : undefined;

  if (existing) {
    // Merge into the existing auth so a reconnect refreshes the token without
    // wiping the user's saved calendarIds selection.
    let auth: Record<string, unknown> = {};
    try {
      auth = JSON.parse(existing.authJson ?? "{}");
    } catch {
      // corrupted auth JSON — rebuild from scratch
    }
    auth.refreshToken = params.refreshToken;
    db.update(tables.accounts)
      .set({ authJson: JSON.stringify(auth), status: "ok", updatedAt: now })
      .where(eq(tables.accounts.id, existing.id))
      .run();
    return existing.id;
  }

  const inserted = db
    .insert(tables.accounts)
    .values({
      kind: "google",
      domain: "calendar",
      label: params.label ?? params.email ?? "Google",
      identity: params.email,
      authJson: JSON.stringify({ refreshToken: params.refreshToken }),
      color: "#8B7BFF",
      status: "ok",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return inserted.id;
}
