import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CSRF / DNS-rebinding defense for the localhost API. A malicious page in the
// user's browser can issue a state-changing request to localhost, but it can't
// forge the Origin header — so we require it to match the app's own host.
// (Next 16 renamed Middleware to Proxy; same functionality.)
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function proxy(req: NextRequest) {
  if (!MUTATING.has(req.method)) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (origin) {
    let hostname: string;
    try {
      hostname = new URL(origin).hostname;
    } catch {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!ALLOWED_HOSTS.has(hostname)) {
      return new NextResponse("Forbidden: cross-origin request blocked", { status: 403 });
    }
  }
  // No Origin header → a non-browser client (e.g. curl); the in-process sync
  // scheduler never goes through HTTP. Not a CSRF vector, so allow it.
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
