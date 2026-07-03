import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_SCOPES, oauthClient } from "@/lib/sources/google";

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/oauth/google/callback`;
  try {
    // CSRF protection: round-trip a random state through an HttpOnly cookie.
    const state = crypto.randomUUID();
    const url = oauthClient(redirectUri).generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      scope: GOOGLE_SCOPES,
      state,
    });
    const res = NextResponse.redirect(url);
    res.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/oauth/google",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    console.error("[oauth] start failed:", err);
    return NextResponse.json({ error: "Failed to start Google OAuth" }, { status: 500 });
  }
}
