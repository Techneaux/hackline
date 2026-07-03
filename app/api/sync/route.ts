import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/lib/db";
import { syncAll } from "@/lib/sync/engine";

export async function GET() {
  const rows = db.select().from(tables.syncState).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  await syncAll({ accountId: body.accountId, domain: body.domain });
  const rows = db.select().from(tables.syncState).all();
  return NextResponse.json({ ok: true, state: rows });
}
