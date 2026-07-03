import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(), // 'google' | 'todoist'
  domain: text("domain").notNull(), // 'calendar' | 'tasks' (future: 'fitness' | 'finance')
  label: text("label").notNull(), // 'OCI', 'Personal'
  identity: text("identity"), // email or null
  authJson: text("auth_json"), // refresh token / API token / secret ICS URL
  color: text("color").notNull().default("#3DDC97"),
  status: text("status").notNull().default("ok"), // 'ok' | 'error' | 'needs_auth'
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    calendarId: text("calendar_id"),
    title: text("title").notNull().default(""),
    description: text("description"),
    location: text("location"),
    startTs: text("start_ts").notNull(), // UTC ISO-8601
    endTs: text("end_ts").notNull(),
    allDay: integer("all_day").notNull().default(0),
    status: text("status").notNull().default("confirmed"), // confirmed | tentative | cancelled
    attendeesJson: text("attendees_json"),
    rawJson: text("raw_json"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("events_account_external").on(t.accountId, t.externalId),
    index("events_start").on(t.startTs),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(), // 'todoist' | 'local'
    externalId: text("external_id"), // Todoist id, NULL for local
    content: text("content").notNull(),
    description: text("description"),
    dueDate: text("due_date"), // 'YYYY-MM-DD'
    dueDatetime: text("due_datetime"), // UTC ISO when time-specific
    priority: integer("priority").notNull().default(1), // Todoist 1..4 (4 = p1/urgent)
    projectId: text("project_id"),
    projectName: text("project_name"),
    sectionId: text("section_id"),
    sectionName: text("section_name"),
    completed: integer("completed").notNull().default(0),
    completedAt: text("completed_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("tasks_source_external").on(t.source, t.externalId),
    index("tasks_due").on(t.dueDate),
  ],
);

export const plannerDays = sqliteTable("planner_days", {
  date: text("date").primaryKey(), // local (America/Chicago) date 'YYYY-MM-DD'
  messageToSelf: text("message_to_self"),
  morningJson: text("morning_json"), // { promptId: answer }
  top3Json: text("top3_json"), // ["...", "...", "..."]
  scheduleNotesJson: text("schedule_notes_json"), // { "06:00": "note", ... } user annotations only
  mustDoJson: text("must_do_json"), // [{ id, taskId?, text?, done }]
  connectJson: text("connect_json"), // [{ person, how }]
  notes: text("notes"),
  eveningJson: text("evening_json"), // { promptId: answer }
  tomorrowPlanned: integer("tomorrow_planned").notNull().default(0), // "planned tomorrow's tasks" checkbox
  morningCompletedAt: text("morning_completed_at"),
  eveningCompletedAt: text("evening_completed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const habitScores = sqliteTable(
  "habit_scores",
  {
    date: text("date").notNull(),
    habit: text("habit").notNull(), // clarity|energy|necessity|productivity|influence|courage
    score: integer("score").notNull(), // 1..5
  },
  (t) => [primaryKey({ columns: [t.date, t.habit] })],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const syncState = sqliteTable(
  "sync_state",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(), // e.g. 'calendar:primary', 'todoist:items'
    cursor: text("cursor"),
    lastSyncedAt: text("last_synced_at"),
    lastError: text("last_error"),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.resource] })],
);

export type Account = typeof accounts.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type PlannerDay = typeof plannerDays.$inferSelect;
