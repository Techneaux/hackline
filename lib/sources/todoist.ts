import type { Account } from "@/lib/db/schema";
import { getJsonSetting, setSetting } from "@/lib/db/settings";
import type { NormalizedTask, TaskDraft, TaskSource, TaskSyncResult } from "./types";

const API = "https://api.todoist.com/api/v1";

// The user's curated views (see dashboard Home/Work sections).
export const HOME_FILTER_NAME = "Personal top priorities";
export const WORK_PROJECT_NAME = "Work - Todo";
export const HOME_PROJECT_NAME = "Personal - Todo";
export const PRIORITY_SECTION_NAME = "Top Priorities";

interface TodoistDue {
  date: string; // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS' (floating) or with 'Z'
  timezone?: string | null;
}

interface TodoistItem {
  id: string;
  content: string;
  description: string;
  due: TodoistDue | null;
  priority: number; // 1..4, 4 = p1 (urgent)
  project_id: string;
  section_id: string | null;
  checked: boolean;
  completed_at: string | null;
  child_order: number;
  is_deleted: boolean;
}

interface TodoistProject {
  id: string;
  name: string;
  is_deleted: boolean;
}

interface TodoistSection {
  id: string;
  project_id: string;
  name: string;
  is_deleted: boolean;
}

interface TodoistFilter {
  id: string;
  name: string;
  query: string;
  is_deleted: boolean;
}

interface SyncResponse {
  sync_token: string;
  full_sync: boolean;
  items?: TodoistItem[];
  projects?: TodoistProject[];
  sections?: TodoistSection[];
  filters?: TodoistFilter[];
}

export interface TodoistMeta {
  projects: { id: string; name: string }[];
  sections: { id: string; projectId: string; name: string }[];
  homeFilterQuery: string | null;
}

function token(_account: Account): string {
  const t = process.env.TODOIST_API_TOKEN;
  if (!t) throw new Error("Set TODOIST_API_TOKEN in .env.local");
  return t;
}

async function api(account: Account, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token(account)}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Todoist ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res;
}

export function normalizeDue(due: TodoistDue | null): { dueDate: string | null; dueDatetime: string | null } {
  if (!due?.date) return { dueDate: null, dueDatetime: null };
  const dueDate = due.date.slice(0, 10);
  if (due.date.length <= 10) return { dueDate, dueDatetime: null };
  // Time-specific. Fixed-timezone dues end in 'Z' (UTC); floating dues are local
  // wall time — stored as-is and interpreted as local when displayed.
  return { dueDate, dueDatetime: due.date };
}

export function todoistMeta(): TodoistMeta {
  return getJsonSetting<TodoistMeta>("todoist.meta", {
    projects: [],
    sections: [],
    homeFilterQuery: null,
  });
}

function saveMeta(meta: TodoistMeta) {
  setSetting("todoist.meta", JSON.stringify(meta));
}

function normalizeItem(item: TodoistItem, meta: TodoistMeta): NormalizedTask {
  const { dueDate, dueDatetime } = normalizeDue(item.due);
  return {
    externalId: item.id,
    content: item.content,
    description: item.description || null,
    dueDate,
    dueDatetime,
    priority: item.priority,
    projectId: item.project_id,
    projectName: meta.projects.find((p) => p.id === item.project_id)?.name ?? null,
    sectionId: item.section_id,
    sectionName: item.section_id
      ? (meta.sections.find((s) => s.id === item.section_id)?.name ?? null)
      : null,
    completed: item.checked,
    completedAt: item.completed_at,
    sortOrder: item.child_order,
  };
}

/**
 * Fetch active task ids matching the user's saved Home filter and cache them
 * (in filter order) for the dashboard. Best-effort: failures leave the last
 * good list in place.
 */
async function refreshHomeFilterIds(account: Account, meta: TodoistMeta): Promise<void> {
  if (!meta.homeFilterQuery) return;
  try {
    let cursor: string | null = null;
    const ids: string[] = [];
    do {
      const params = new URLSearchParams({ query: meta.homeFilterQuery, limit: "200" });
      if (cursor) params.set("cursor", cursor);
      const res = await api(account, `/tasks/filter?${params}`);
      const data = (await res.json()) as { results?: { id: string }[]; next_cursor?: string | null };
      for (const t of data.results ?? []) ids.push(t.id);
      cursor = data.next_cursor ?? null;
    } while (cursor);
    setSetting("todoist.homeFilterIds", JSON.stringify(ids));
  } catch (err) {
    console.error("[todoist] home filter refresh failed:", err);
  }
}

export function homeFilterIds(): string[] {
  return getJsonSetting<string[]>("todoist.homeFilterIds", []);
}

/** Deep link to a synced project in the Todoist app, or null if not synced yet. */
export function projectUrl(projectName: string): string | null {
  const project = todoistMeta().projects.find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase(),
  );
  if (!project) return null;
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `https://app.todoist.com/app/project/${slug}-${project.id}`;
}

export function appendHomeFilterId(id: string): void {
  const ids = homeFilterIds();
  if (!ids.includes(id)) setSetting("todoist.homeFilterIds", JSON.stringify([...ids, id]));
}

export const todoistSource: TaskSource = {
  kind: "todoist",

  async sync(account: Account, cursor: string | null): Promise<TaskSyncResult> {
    // A cursor from before sections/filters were synced won't backfill them
    // (sync tokens only carry changes) — force a full sync until meta exists.
    const effectiveCursor = todoistMeta().projects.length ? cursor : null;
    const res = await api(account, "/sync", {
      method: "POST",
      body: JSON.stringify({
        sync_token: effectiveCursor ?? "*",
        resource_types: ["items", "projects", "sections", "filters"],
      }),
    });
    const data = (await res.json()) as SyncResponse;

    const meta = todoistMeta();
    for (const p of data.projects ?? []) {
      const rest = meta.projects.filter((x) => x.id !== p.id);
      meta.projects = p.is_deleted ? rest : [...rest, { id: p.id, name: p.name }];
    }
    for (const s of data.sections ?? []) {
      const rest = meta.sections.filter((x) => x.id !== s.id);
      meta.sections = s.is_deleted ? rest : [...rest, { id: s.id, projectId: s.project_id, name: s.name }];
    }
    for (const f of data.filters ?? []) {
      if (!f.is_deleted && f.name.trim().toLowerCase() === HOME_FILTER_NAME.toLowerCase()) {
        meta.homeFilterQuery = f.query;
      }
    }
    saveMeta(meta);

    const upserts: NormalizedTask[] = [];
    const deletedIds: string[] = [];
    for (const item of data.items ?? []) {
      if (item.is_deleted) deletedIds.push(item.id);
      else upserts.push(normalizeItem(item, meta));
    }

    await refreshHomeFilterIds(account, meta);
    return { upserts, deletedIds, nextCursor: data.sync_token, full: data.full_sync };
  },

  async complete(account, externalId) {
    await api(account, `/tasks/${externalId}/close`, { method: "POST" });
  },

  async reopen(account, externalId) {
    await api(account, `/tasks/${externalId}/reopen`, { method: "POST" });
  },

  async add(account, draft: TaskDraft) {
    const res = await api(account, "/tasks", {
      method: "POST",
      body: JSON.stringify({
        content: draft.content,
        description: draft.description,
        due_date: draft.dueDate,
        due_datetime: draft.dueDatetime,
        priority: draft.priority,
        project_id: draft.projectId,
        section_id: draft.sectionId,
      }),
    });
    const t = (await res.json()) as {
      id: string;
      content: string;
      description: string;
      due: TodoistDue | null;
      priority: number;
      project_id: string;
      section_id: string | null;
    };
    const { dueDate, dueDatetime } = normalizeDue(t.due);
    const meta = todoistMeta();
    return {
      externalId: t.id,
      content: t.content,
      description: t.description || null,
      dueDate,
      dueDatetime,
      priority: t.priority,
      projectId: t.project_id,
      projectName: meta.projects.find((p) => p.id === t.project_id)?.name ?? null,
      sectionId: t.section_id,
      sectionName: t.section_id
        ? (meta.sections.find((s) => s.id === t.section_id)?.name ?? null)
        : null,
      completed: false,
      completedAt: null,
      sortOrder: 0,
    };
  },

  async update(account, externalId, patch) {
    const body: Record<string, unknown> = {};
    if (patch.content !== undefined) body.content = patch.content;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.dueDate !== undefined) body.due_date = patch.dueDate;
    if (patch.dueDatetime !== undefined) body.due_datetime = patch.dueDatetime;
    if (patch.priority !== undefined) body.priority = patch.priority;
    await api(account, `/tasks/${externalId}`, { method: "POST", body: JSON.stringify(body) });
  },
};
