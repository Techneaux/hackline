import { NextResponse } from "next/server";
import { db, tables } from "@/lib/db";

// Accounts are provisioned by the app, not this route: Google via the OAuth
// callback, Todoist from TODOIST_API_TOKEN on boot. This endpoint is read-only.
export async function GET() {
  const rows = db.select().from(tables.accounts).all();
  // Never ship tokens to the client.
  return NextResponse.json(
    rows.map(({ authJson, ...rest }) => ({ ...rest, hasAuth: Boolean(authJson) })),
  );
}
