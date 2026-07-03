import { NextResponse } from "next/server";
import { projectUrl, WORK_PROJECT_NAME } from "@/lib/sources/todoist";

// The Todoist deep link for the Work priority project, derived from synced
// data (kept out of source so the repo carries no personal project ids).
export async function GET() {
  return NextResponse.json({ url: projectUrl(WORK_PROJECT_NAME) });
}
