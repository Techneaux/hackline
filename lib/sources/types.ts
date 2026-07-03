import type { Account } from "@/lib/db/schema";

export interface NormalizedEvent {
  externalId: string;
  calendarId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTs: string; // UTC ISO
  endTs: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
  attendees?: { email?: string; name?: string; self?: boolean; responseStatus?: string }[];
  raw?: unknown;
}

export interface NormalizedTask {
  externalId: string | null;
  content: string;
  description?: string | null;
  dueDate?: string | null;
  dueDatetime?: string | null;
  priority: number;
  projectId?: string | null;
  projectName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  completed: boolean;
  completedAt?: string | null;
  sortOrder: number;
}

export interface SyncWindow {
  from: Date;
  to: Date;
}

export interface CalendarSyncResult {
  events: NormalizedEvent[];
  deletedIds: string[];
  nextCursor: string | null;
  /** true = full window snapshot for the whole account; reconcile by delete-and-replace */
  full: boolean;
  /**
   * Calendars that were fully re-fetched this run (initial sync or expired
   * cursor): the engine delete-and-replaces the window for just these, so
   * events removed remotely during a cursor gap don't linger.
   */
  replacedCalendarIds?: string[];
}

export interface CalendarSource {
  kind: string;
  sync(account: Account, cursor: string | null, window: SyncWindow): Promise<CalendarSyncResult>;
}

export interface TaskSyncResult {
  upserts: NormalizedTask[];
  deletedIds: string[];
  nextCursor: string | null;
  full: boolean;
}

export interface TaskDraft {
  content: string;
  description?: string;
  dueDate?: string;
  dueDatetime?: string;
  priority?: number;
  projectId?: string;
  sectionId?: string;
}

export interface TaskSource {
  kind: string;
  sync(account: Account, cursor: string | null): Promise<TaskSyncResult>;
  complete(account: Account, externalId: string): Promise<void>;
  reopen(account: Account, externalId: string): Promise<void>;
  add(account: Account, draft: TaskDraft): Promise<NormalizedTask>;
  update(account: Account, externalId: string, patch: Partial<TaskDraft>): Promise<void>;
}
