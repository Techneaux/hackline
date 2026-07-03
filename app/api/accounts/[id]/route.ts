import { NextRequest, NextResponse } from "next/server";
import { eq, like } from "drizzle-orm";
import { db, tables } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const account = db.select().from(tables.accounts).where(eq(tables.accounts.id, accountId)).get();
  if (!account) return NextResponse.json({ ok: true });

  db.transaction((tx) => {
    // Calendar events + sync state cascade via FK; tasks are keyed by source,
    // so remove them (and cached metadata) explicitly or they'd be stranded,
    // visible but permanently uncompletable.
    if (account.domain === "tasks") {
      tx.delete(tables.tasks).where(eq(tables.tasks.source, account.kind)).run();
      tx.delete(tables.appSettings).where(like(tables.appSettings.key, `${account.kind}.%`)).run();
    }
    tx.delete(tables.accounts).where(eq(tables.accounts.id, accountId)).run();
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await req.json();
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.label !== undefined) set.label = body.label;
  if (body.color !== undefined) set.color = body.color;
  if (body.auth !== undefined) set.authJson = JSON.stringify(body.auth);
  const updated = db
    .update(tables.accounts)
    .set(set)
    .where(eq(tables.accounts.id, accountId))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { authJson, ...rest } = updated;
  return NextResponse.json({ ...rest, hasAuth: Boolean(authJson) });
}
